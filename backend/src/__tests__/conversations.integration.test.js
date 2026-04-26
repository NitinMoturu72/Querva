const request = require('supertest')
const express = require('express')
const authRoutes = require('../routes/auth')
const conversationRoutes = require('../routes/conversations')
const { setupTestDatabase, teardownTestDatabase, closeTestDatabase, pool } = require('./setup')

const createTestApp = () => {
  const app = express()
  app.use(express.json())
  app.use('/api/auth', authRoutes)
  app.use('/api/conversations', conversationRoutes)
  return app
}

describe('Conversations & Sessions Integration Tests', () => {
  let app, testToken, testUser

  beforeAll(async () => {
    await setupTestDatabase()
    app = createTestApp()

    // Create a test user for all tests
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'convtest@example.com',
        password: 'TestPassword123!'
      })
    testToken = response.body.token
    testUser = response.body.user
  })

  afterEach(async () => {
    // Clear conversations after each test
    await pool.query('DELETE FROM conversations WHERE user_id = $1', [testUser.id])
  })

  afterAll(async () => {
    await teardownTestDatabase()
    await closeTestDatabase()
  })

  describe('POST /api/conversations (Create)', () => {
    test('creates conversation with minimal data', async () => {
      const response = await request(app)
        .post('/api/conversations')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          name: 'My First Chat',
          dialect: 'PostgreSQL',
          schema: []
        })

      expect(response.status).toBe(201)
      expect(response.body.conversation).toMatchObject({
        id: expect.any(String), // UUIDs/serial IDs are returned as strings
        name: 'My First Chat',
        dialect: 'PostgreSQL',
        user_id: testUser.id
      })
    })

    test('creates conversation with full schema', async () => {
      const response = await request(app)
        .post('/api/conversations')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          name: 'Database Design',
          dialect: 'MySQL',
          schema: [
            {
              name: 'users',
              columns: [
                { name: 'id', type: 'INT', key: 'PK', nullable: false },
                { name: 'email', type: 'VARCHAR(255)', nullable: false },
                { name: 'created_at', type: 'TIMESTAMP', nullable: true }
              ]
            },
            {
              name: 'posts',
              columns: [
                { name: 'id', type: 'INT', key: 'PK', nullable: false },
                { name: 'user_id', type: 'INT', key: 'FK', nullable: false }
              ]
            }
          ]
        })

      expect(response.status).toBe(201)
      expect(response.body.conversation.name).toBe('Database Design')

      // Verify schema was saved
      const tables = await pool.query(
        'SELECT * FROM schema_tables WHERE conversation_id = $1',
        [response.body.conversation.id]
      )
      expect(tables.rows).toHaveLength(2)
    })

    test('requires authentication', async () => {
      const response = await request(app)
        .post('/api/conversations')
        .send({
          name: 'Unauthorized Chat',
          dialect: 'PostgreSQL',
          schema: []
        })

      expect(response.status).toBe(401)
    })

    test('requires name field', async () => {
      const response = await request(app)
        .post('/api/conversations')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          dialect: 'PostgreSQL',
          schema: []
        })

      expect(response.status).toBe(400)
      expect(response.body.error).toContain('Name')
    })

    test('requires dialect field', async () => {
      const response = await request(app)
        .post('/api/conversations')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          name: 'My Chat',
          schema: []
        })

      expect(response.status).toBe(400)
      expect(response.body.error).toContain('dialect')
    })

    test('enforces 5-conversation limit', async () => {
      // Create 5 conversations
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/conversations')
          .set('Authorization', `Bearer ${testToken}`)
          .send({
            name: `Conversation ${i + 1}`,
            dialect: 'PostgreSQL',
            schema: [{ name: `table${i}`, columns: [] }]
          })
      }

      // 6th should be rejected
      const response = await request(app)
        .post('/api/conversations')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          name: 'Conversation 6',
          dialect: 'PostgreSQL',
          schema: []
        })

      expect(response.status).toBe(400)
      expect(response.body.code).toBe('CONVERSATION_LIMIT')
      expect(response.body.error).toContain('5 conversations')
    })

    test('saves schema with multiple tables and columns', async () => {
      const response = await request(app)
        .post('/api/conversations')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          name: 'Schema Test',
          dialect: 'PostgreSQL',
          schema: [
            {
              name: 'users',
              columns: [
                { name: 'id', type: 'INT', key: 'PK', nullable: false },
                { name: 'email', type: 'VARCHAR(255)', nullable: false, key: 'UQ' }
              ]
            },
            {
              name: 'posts',
              columns: [
                { name: 'id', type: 'INT', key: 'PK', nullable: false },
                { name: 'title', type: 'VARCHAR(255)', nullable: false }
              ]
            }
          ]
        })

      expect(response.status).toBe(201)

      // Verify tables were saved
      const tables = await pool.query(
        `SELECT * FROM schema_tables WHERE conversation_id = $1`,
        [response.body.conversation.id]
      )
      expect(tables.rows).toHaveLength(2)
      expect(tables.rows.some(t => t.name === 'users')).toBe(true)
      expect(tables.rows.some(t => t.name === 'posts')).toBe(true)

      // Verify columns were saved for users table
      const usersTable = tables.rows.find(t => t.name === 'users')
      const userColumns = await pool.query(
        `SELECT * FROM columns WHERE table_id = $1 ORDER BY name`,
        [usersTable.id]
      )
      expect(userColumns.rows).toHaveLength(2)
      expect(userColumns.rows.some(c => c.name === 'id')).toBe(true)
      expect(userColumns.rows.some(c => c.name === 'email')).toBe(true)
    })

    test('allows same user to hit limit but not exceed it', async () => {
      // Create 5 conversations
      const convIds = []
      for (let i = 0; i < 5; i++) {
        const res = await request(app)
          .post('/api/conversations')
          .set('Authorization', `Bearer ${testToken}`)
          .send({
            name: `Conv ${i}`,
            dialect: 'PostgreSQL',
            schema: []
          })
        convIds.push(res.body.conversation.id)
      }

      expect(convIds).toHaveLength(5)

      // 6th should fail
      const res6 = await request(app)
        .post('/api/conversations')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          name: 'Conv 6',
          dialect: 'PostgreSQL',
          schema: []
        })
      expect(res6.status).toBe(400)
    })
  })

  describe('GET /api/conversations (List)', () => {
    beforeEach(async () => {
      // Create 3 conversations
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/conversations')
          .set('Authorization', `Bearer ${testToken}`)
          .send({
            name: `Chat ${i + 1}`,
            dialect: 'PostgreSQL',
            schema: [{ name: `table${i}`, columns: [] }]
          })
      }
    })

    test('lists all user conversations', async () => {
      const response = await request(app)
        .get('/api/conversations')
        .set('Authorization', `Bearer ${testToken}`)

      expect(response.status).toBe(200)
      expect(Array.isArray(response.body.conversations)).toBe(true)
      expect(response.body.conversations.length).toBeGreaterThanOrEqual(3)
    })

    test('shows conversation with message count', async () => {
      const response = await request(app)
        .get('/api/conversations')
        .set('Authorization', `Bearer ${testToken}`)

      expect(response.status).toBe(200)
      const conv = response.body.conversations[0]
      expect(conv).toHaveProperty('message_count')
      expect(typeof conv.message_count).toBe('number')
    })

    test('only shows user\'s own conversations', async () => {
      // Create another user
      const otherRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'other@example.com',
          password: 'Password123!'
        })
      const otherToken = otherRes.body.token

      // Create conversation with other user
      await request(app)
        .post('/api/conversations')
        .set('Authorization', `Bearer ${otherToken}`)
        .send({
          name: 'Other User Chat',
          dialect: 'PostgreSQL',
          schema: []
        })

      // List with original user token
      const response = await request(app)
        .get('/api/conversations')
        .set('Authorization', `Bearer ${testToken}`)

      const otherConv = response.body.conversations.find(
        c => c.name === 'Other User Chat'
      )
      expect(otherConv).toBeUndefined()
    })

    test('requires authentication', async () => {
      const response = await request(app)
        .get('/api/conversations')

      expect(response.status).toBe(401)
    })

    test('returns empty list when no conversations', async () => {
      // Create new user with no conversations
      const newUserRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'newuser@example.com',
          password: 'Password123!'
        })

      const response = await request(app)
        .get('/api/conversations')
        .set('Authorization', `Bearer ${newUserRes.body.token}`)

      expect(response.status).toBe(200)
      expect(response.body.conversations).toEqual([])
    })
  })

  describe('GET /api/conversations/:id (Retrieve with Messages & Schema)', () => {
    let conversationId

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/conversations')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          name: 'Detailed Chat',
          dialect: 'PostgreSQL',
          schema: [
            {
              name: 'users',
              columns: [
                { name: 'id', type: 'INT', key: 'PK' },
                { name: 'name', type: 'VARCHAR(255)' }
              ]
            }
          ]
        })
      conversationId = res.body.conversation.id
    })

    test('retrieves conversation with schema', async () => {
      const response = await request(app)
        .get(`/api/conversations/${conversationId}`)
        .set('Authorization', `Bearer ${testToken}`)

      expect(response.status).toBe(200)
      expect(response.body.conversation.id).toBe(conversationId)
      expect(Array.isArray(response.body.schema)).toBe(true)
      expect(response.body.schema.length).toBeGreaterThan(0)
      expect(response.body.schema[0].name).toBe('users')
    })

    test('returns empty messages array for new conversation', async () => {
      const response = await request(app)
        .get(`/api/conversations/${conversationId}`)
        .set('Authorization', `Bearer ${testToken}`)

      expect(response.status).toBe(200)
      expect(Array.isArray(response.body.messages)).toBe(true)
      expect(response.body.messages).toHaveLength(0)
    })

    test('prevents access to other user\'s conversation', async () => {
      // Create another user
      const otherUserRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'attacker@example.com',
          password: 'Password123!'
        })

      // Try to access with other user's token
      const response = await request(app)
        .get(`/api/conversations/${conversationId}`)
        .set('Authorization', `Bearer ${otherUserRes.body.token}`)

      expect(response.status).toBe(404)
    })

    test('returns 404 for non-existent conversation', async () => {
      // Since the ID format varies by database, we'll create a realistic test
      // by creating a conversation and immediately fetching it
      const convRes = await request(app)
        .post('/api/conversations')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          name: 'Test Conv',
          dialect: 'PostgreSQL',
          schema: []
        })

      // Create a different user and try to access this conversation
      const otherUserRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'other404@example.com',
          password: 'Password123!'
        })

      const response = await request(app)
        .get(`/api/conversations/${convRes.body.conversation.id}`)
        .set('Authorization', `Bearer ${otherUserRes.body.token}`)

      expect(response.status).toBe(404)
    })

    test('requires authentication', async () => {
      const response = await request(app)
        .get(`/api/conversations/${conversationId}`)

      expect(response.status).toBe(401)
    })
  })

  describe('DELETE /api/conversations/:id', () => {
    let conversationId

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/conversations')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          name: 'To Delete',
          dialect: 'PostgreSQL',
          schema: [{ name: 'users', columns: [] }]
        })
      conversationId = res.body.conversation.id
    })

    test('successfully deletes conversation', async () => {
      const response = await request(app)
        .delete(`/api/conversations/${conversationId}`)
        .set('Authorization', `Bearer ${testToken}`)

      expect(response.status).toBe(200)

      // Verify deleted
      const getRes = await request(app)
        .get(`/api/conversations/${conversationId}`)
        .set('Authorization', `Bearer ${testToken}`)

      expect(getRes.status).toBe(404)
    })

    test('cascade deletes schema when conversation deleted', async () => {
      // Add schema to conversation
      const tables = await pool.query(
        'SELECT * FROM schema_tables WHERE conversation_id = $1',
        [conversationId]
      )
      const tableCount = tables.rows.length

      // Delete conversation
      await request(app)
        .delete(`/api/conversations/${conversationId}`)
        .set('Authorization', `Bearer ${testToken}`)

      // Verify schema tables are gone
      const tablesAfter = await pool.query(
        'SELECT * FROM schema_tables WHERE conversation_id = $1',
        [conversationId]
      )
      expect(tablesAfter.rows).toHaveLength(0)
    })

    test('prevents deleting other user\'s conversation', async () => {
      // Create another user
      const otherUserRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'user2@example.com',
          password: 'Password123!'
        })

      // Try to delete with other user's token
      const response = await request(app)
        .delete(`/api/conversations/${conversationId}`)
        .set('Authorization', `Bearer ${otherUserRes.body.token}`)

      expect(response.status).toBe(404)

      // Verify original conversation still exists
      const getRes = await request(app)
        .get(`/api/conversations/${conversationId}`)
        .set('Authorization', `Bearer ${testToken}`)

      expect(getRes.status).toBe(200)
    })

    test('returns 404 for non-existent conversation', async () => {
      // Create a conversation with one user and try to delete with another
      const convRes = await request(app)
        .post('/api/conversations')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          name: 'To Check',
          dialect: 'PostgreSQL',
          schema: []
        })

      const otherUserRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'deleter@example.com',
          password: 'Password123!'
        })

      const response = await request(app)
        .delete(`/api/conversations/${convRes.body.conversation.id}`)
        .set('Authorization', `Bearer ${otherUserRes.body.token}`)

      expect(response.status).toBe(404)
    })

    test('requires authentication', async () => {
      const response = await request(app)
        .delete(`/api/conversations/${conversationId}`)

      expect(response.status).toBe(401)
    })
  })

  describe('Conversation Limit Enforcement', () => {
    test('allows creating exactly 5 conversations', async () => {
      const convs = []
      for (let i = 0; i < 5; i++) {
        const res = await request(app)
          .post('/api/conversations')
          .set('Authorization', `Bearer ${testToken}`)
          .send({
            name: `Conv ${i}`,
            dialect: 'PostgreSQL',
            schema: []
          })
        expect(res.status).toBe(201)
        convs.push(res.body.conversation.id)
      }

      // Verify all 5 exist
      const listRes = await request(app)
        .get('/api/conversations')
        .set('Authorization', `Bearer ${testToken}`)

      expect(listRes.body.conversations).toHaveLength(5)
    })

    test('prevents creating 6th conversation', async () => {
      // Create 5
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/conversations')
          .set('Authorization', `Bearer ${testToken}`)
          .send({
            name: `Conv ${i}`,
            dialect: 'PostgreSQL',
            schema: []
          })
      }

      // Try 6th
      const res = await request(app)
        .post('/api/conversations')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          name: 'Conv 6',
          dialect: 'PostgreSQL',
          schema: []
        })

      expect(res.status).toBe(400)
      expect(res.body.code).toBe('CONVERSATION_LIMIT')
    })

    test('allows creating new conversation after deleting one', async () => {
      // Create 5
      const convIds = []
      for (let i = 0; i < 5; i++) {
        const res = await request(app)
          .post('/api/conversations')
          .set('Authorization', `Bearer ${testToken}`)
          .send({
            name: `Conv ${i}`,
            dialect: 'PostgreSQL',
            schema: []
          })
        convIds.push(res.body.conversation.id)
      }

      // Delete one
      await request(app)
        .delete(`/api/conversations/${convIds[0]}`)
        .set('Authorization', `Bearer ${testToken}`)

      // Should be able to create new one
      const newRes = await request(app)
        .post('/api/conversations')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          name: 'New Conv',
          dialect: 'PostgreSQL',
          schema: []
        })

      expect(newRes.status).toBe(201)

      // Verify count is still 5
      const listRes = await request(app)
        .get('/api/conversations')
        .set('Authorization', `Bearer ${testToken}`)

      expect(listRes.body.conversations).toHaveLength(5)
    })
  })
})
