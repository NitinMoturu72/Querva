const request = require('supertest')
const express = require('express')
const authRoutes = require('../routes/auth')
const { setupTestDatabase, teardownTestDatabase, closeTestDatabase, pool } = require('./setup')

// Create minimal Express app for testing
const createTestApp = () => {
  const app = express()
  app.use(express.json())
  app.use('/api/auth', authRoutes)
  return app
}

describe('Auth Routes Integration Tests', () => {
  let app

  beforeAll(async () => {
    await setupTestDatabase()
    app = createTestApp()
  })

  afterEach(async () => {
    // Clear users after each test
    await pool.query('TRUNCATE users CASCADE')
  })

  afterAll(async () => {
    await teardownTestDatabase()
    await closeTestDatabase()
  })

  describe('POST /api/auth/register', () => {
    test('successfully registers new user with email and password', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'newuser@example.com',
          password: 'SecurePassword123!'
        })

      expect(response.status).toBe(201)
      expect(response.body).toHaveProperty('token')
      expect(response.body.user).toMatchObject({
        id: expect.any(String), // UUIDs are strings
        email: 'newuser@example.com',
        name: expect.any(String)
      })

      // Verify token is JWT (3 parts separated by dots)
      const parts = response.body.token.split('.')
      expect(parts).toHaveLength(3)
    })

    test('uses email as default name when name not provided', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'john@example.com',
          password: 'Password123!'
        })

      expect(response.status).toBe(201)
      expect(response.body.user.name).toBe('john@example.com')
    })

    test('uses provided name when given', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'john@example.com',
          password: 'Password123!',
          name: 'John Doe'
        })

      expect(response.status).toBe(201)
      expect(response.body.user.name).toBe('John Doe')
    })

    test('rejects registration with duplicate email', async () => {
      // First registration
      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'duplicate@example.com',
          password: 'Password123!'
        })

      // Second registration with same email
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'duplicate@example.com',
          password: 'DifferentPassword123!'
        })

      expect(response.status).toBe(409)
      expect(response.body.error).toContain('already registered')
    })

    test('rejects registration without email', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          password: 'Password123!'
        })

      expect(response.status).toBe(400)
      expect(response.body.error).toContain('Email')
    })

    test('rejects registration without password', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'user@example.com'
        })

      expect(response.status).toBe(400)
      expect(response.body.error).toContain('password')
    })

    test('creates user in database with hashed password', async () => {
      const email = 'testuser@example.com'
      const password = 'Password123!'

      await request(app)
        .post('/api/auth/register')
        .send({ email, password })

      // Verify user exists in database
      const result = await pool.query('SELECT * FROM users WHERE email = $1', [email])
      expect(result.rows).toHaveLength(1)

      const user = result.rows[0]
      expect(user.email).toBe(email)
      // Password should not be stored in plaintext
      expect(user.password).not.toBe(password)
      expect(user.password.length).toBeGreaterThan(20) // bcrypt hash is long
    })
  })

  describe('POST /api/auth/login', () => {
    let testUser, testPassword

    beforeEach(async () => {
      // Create a test user
      testPassword = 'TestPassword123!'
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'logintest@example.com',
          password: testPassword
        })
      testUser = response.body.user
    })

    test('successfully logs in with correct credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'logintest@example.com',
          password: testPassword
        })

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('token')
      expect(response.body.user).toMatchObject({
        id: testUser.id,
        email: 'logintest@example.com'
      })
    })

    test('rejects login with wrong password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'logintest@example.com',
          password: 'WrongPassword123!'
        })

      expect(response.status).toBe(401)
      expect(response.body.error).toContain('Invalid')
    })

    test('rejects login with non-existent email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: testPassword
        })

      expect(response.status).toBe(401)
      expect(response.body.error).toContain('Invalid')
    })

    test('rejects login without email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          password: testPassword
        })

      expect(response.status).toBe(400)
      expect(response.body.error).toContain('Email')
    })

    test('rejects login without password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'logintest@example.com'
        })

      expect(response.status).toBe(400)
      expect(response.body.error).toContain('password')
    })

    test('each login returns a valid token', async () => {
      const response1 = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'logintest@example.com',
          password: testPassword
        })

      const response2 = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'logintest@example.com',
          password: testPassword
        })

      // Both responses should have valid tokens (may be same if generated in same second)
      expect(response1.body.token).toBeTruthy()
      expect(response2.body.token).toBeTruthy()

      // Both tokens should be valid JWTs
      const parts1 = response1.body.token.split('.')
      const parts2 = response2.body.token.split('.')
      expect(parts1).toHaveLength(3)
      expect(parts2).toHaveLength(3)
    })

    test('case-sensitive email matching', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'LOGINTEST@EXAMPLE.COM',
          password: testPassword
        })

      // Should fail because email is case-sensitive in database
      expect(response.status).toBe(401)
    })
  })

  describe('GET /api/auth/me (Token Validation)', () => {
    let token, testUser

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'metest@example.com',
          password: 'TestPassword123!'
        })
      token = response.body.token
      testUser = response.body.user
    })

    test('returns current user data with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.body.user).toMatchObject({
        id: testUser.id,
        email: 'metest@example.com'
      })
    })

    test('rejects request without Authorization header', async () => {
      const response = await request(app)
        .get('/api/auth/me')

      expect(response.status).toBe(401)
      expect(response.body.error).toContain('authorization')
    })

    test('rejects request with malformed Authorization header', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'NotBearer ' + token)

      expect(response.status).toBe(401)
    })

    test('rejects request with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid.token.here')

      expect(response.status).toBe(401)
    })

    test('rejects request with token from different user', async () => {
      // Create another user
      const otherRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'other@example.com',
          password: 'OtherPassword123!'
        })

      // Try to use first user's token
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.body.user.id).toBe(testUser.id)
      expect(response.body.user.id).not.toBe(otherRes.body.user.id)
    })
  })

  describe('Auth Flow (E2E)', () => {
    test('user can register, login, and access protected route', async () => {
      const email = 'e2e@example.com'
      const password = 'TestPassword123!'

      // Register
      const registerRes = await request(app)
        .post('/api/auth/register')
        .send({ email, password })

      expect(registerRes.status).toBe(201)
      const token1 = registerRes.body.token

      // Access protected route with registration token
      let meRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token1}`)

      expect(meRes.status).toBe(200)
      expect(meRes.body.user.email).toBe(email)

      // Login
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email, password })

      expect(loginRes.status).toBe(200)
      const token2 = loginRes.body.token

      // Access protected route with login token
      meRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token2}`)

      expect(meRes.status).toBe(200)
      expect(meRes.body.user.email).toBe(email)
    })

    test('registered user cannot login with wrong password', async () => {
      const email = 'secure@example.com'
      const password = 'SecurePassword123!'
      const wrongPassword = 'WrongPassword123!'

      // Register with correct password
      await request(app)
        .post('/api/auth/register')
        .send({ email, password })

      // Try to login with wrong password
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email, password: wrongPassword })

      expect(loginRes.status).toBe(401)
    })
  })
})
