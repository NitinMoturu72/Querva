const express = require('express')
const { authMiddleware } = require('../middleware/auth')
const { getOne, getAll, insert, execute } = require('../lib/dbUtils')

const router = express.Router()

/**
 * GET /api/conversations
 *
 * List all conversations for the authenticated user
 * Protected: requires valid JWT token
 *
 * Response:
 * [
 *   {
 *     "id": "...",
 *     "name": "Query about users table",
 *     "dialect": "PostgreSQL",
 *     "created_at": "2026-04-25T...",
 *     "updated_at": "2026-04-25T...",
 *     "message_count": 5
 *   }
 * ]
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.user

    const conversations = await getAll(
      `SELECT
         c.id,
         c.name,
         c.dialect,
         c.created_at,
         c.updated_at,
         COUNT(m.id)::INTEGER as message_count
       FROM conversations c
       LEFT JOIN messages m ON c.id = m.conversation_id
       WHERE c.user_id = $1
       GROUP BY c.id
       ORDER BY c.updated_at DESC`,
      [userId]
    )

    res.json({ conversations })
  } catch (err) {
    console.error('Get conversations error:', err)
    res.status(500).json({ error: 'Failed to fetch conversations' })
  }
})

/**
 * POST /api/conversations
 *
 * Create new conversation
 * Protected: requires valid JWT token
 *
 * Request body:
 * {
 *   "name": "Query about users table",
 *   "dialect": "PostgreSQL",
 *   "schema": [{ name: "users", columns: [...] }]
 * }
 *
 * Response:
 * {
 *   "id": "...",
 *   "name": "Query about users table",
 *   "dialect": "PostgreSQL",
 *   "user_id": "...",
 *   "created_at": "2026-04-25T..."
 * }
 */
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.user
    const { name, dialect, schema } = req.body

    if (!name || !dialect) {
      return res.status(400).json({ error: 'Name and dialect required' })
    }

    // Create conversation
    const conversation = await insert(
      `INSERT INTO conversations (user_id, name, dialect)
       VALUES ($1, $2, $3)
       RETURNING id, user_id, name, dialect, created_at, updated_at`,
      [userId, name, dialect]
    )

    // If schema provided, save schema tables and columns
    if (schema && schema.length > 0) {
      for (const table of schema) {
        const tableResult = await insert(
          `INSERT INTO schema_tables (conversation_id, name)
           VALUES ($1, $2)
           RETURNING id`,
          [conversation.id, table.name]
        )

        // Save columns for this table
        if (table.columns && table.columns.length > 0) {
          for (const col of table.columns) {
            await insert(
              `INSERT INTO columns (table_id, name, type, nullable, key_type, default_val)
               VALUES ($1, $2, $3, $4, $5, $6)`,
              [
                tableResult.id,
                col.name,
                col.type,
                col.nullable !== false,
                col.key || 'none',
                col.default || null,
              ]
            )

            // Save FK references if applicable
            if (col.key === 'FK' && col.references) {
              await insert(
                `INSERT INTO column_references (column_id, referenced_table, referenced_column)
                 VALUES ($1, $2, $3)`,
                [col.id, col.references.table, col.references.column]
              )
            }
          }
        }
      }
    }

    res.status(201).json({ conversation })
  } catch (err) {
    console.error('Create conversation error:', err)
    res.status(500).json({ error: 'Failed to create conversation' })
  }
})

/**
 * GET /api/conversations/:conversationId
 *
 * Get single conversation with all messages and schema
 * Protected: requires valid JWT token
 *
 * Response:
 * {
 *   "conversation": { ... },
 *   "messages": [ ... ],
 *   "schema": [ ... ]
 * }
 */
router.get('/:conversationId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.user
    const { conversationId } = req.params

    // Get conversation (verify it belongs to user)
    const conversation = await getOne(
      'SELECT * FROM conversations WHERE id = $1 AND user_id = $2',
      [conversationId, userId]
    )

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' })
    }

    // Get all messages in conversation
    const messages = await getAll(
      'SELECT id, role, content, sql_query, created_at FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC',
      [conversationId]
    )

    // Get schema for this conversation
    const schemaTables = await getAll(
      `SELECT st.id, st.name, st.sort_order,
              json_agg(json_build_object(
                'id', c.id,
                'name', c.name,
                'type', c.type,
                'nullable', c.nullable,
                'key', c.key_type,
                'default', c.default_val
              )) as columns
       FROM schema_tables st
       LEFT JOIN columns c ON st.id = c.table_id
       WHERE st.conversation_id = $1
       GROUP BY st.id, st.name, st.sort_order
       ORDER BY st.sort_order`,
      [conversationId]
    )

    res.json({
      conversation,
      messages,
      schema: schemaTables,
    })
  } catch (err) {
    console.error('Get conversation error:', err)
    res.status(500).json({ error: 'Failed to fetch conversation' })
  }
})

module.exports = router
