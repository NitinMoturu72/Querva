const express = require('express')
const { schemaToContext, extractJsonObject, callGroq } = require('../lib/groq')
const { authMiddleware } = require('../middleware/auth')
const { getOne, insert } = require('../lib/dbUtils')

const router = express.Router()

/**
 * POST /api/query - Generate SQL query
 *
 * Now saves messages to database if conversationId is provided
 * Protected: requires valid JWT token
 *
 * Request body:
 * {
 *   "question": "Show all users",
 *   "schema": [...],
 *   "dialect": "PostgreSQL",
 *   "conversationHistory": [...],
 *   "conversationId": "..." (optional - if saving to conversation)
 * }
 */
router.post('/query', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.user
    const { question, schema, dialect, conversationHistory, conversationId } = req.body

    if (!question || !schema || !dialect) {
      return res.status(400).json({ error: 'Missing required fields: question, schema, dialect' })
    }

    // If conversationId provided, verify it belongs to user
    if (conversationId) {
      const conversation = await getOne(
        'SELECT id FROM conversations WHERE id = $1 AND user_id = $2',
        [conversationId, userId]
      )
      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found or not authorized' })
      }
    }

    const schemaDDL = schemaToContext(schema, dialect)

    const systemPrompt = [
      'You are a SQL assistant.',
      `Generate ${dialect} SQL only from the provided schema.`,
      'Do not invent tables or columns.',
      'Return valid JSON with exactly two string keys: message and query.',
      'message should briefly explain the query intent.',
      'query should be executable SQL without markdown fences.',
    ].join(' ')

    const userPrompt = [
      `User question: ${question}`,
      `Dialect: ${dialect}`,
      'Schema:',
      schemaDDL || '-- No schema provided --',
    ].join('\n\n')

    const messagesArray = [
      { role: 'system', content: systemPrompt },
      ...(conversationHistory || []),
      { role: 'user', content: userPrompt },
    ]

    const content = await callGroq(messagesArray, { temperature: 0.2, returnJson: true })
    const parsed = extractJsonObject(content)

    if (!parsed || typeof parsed.message !== 'string' || typeof parsed.query !== 'string') {
      throw new Error('Groq response was not valid JSON with message and query fields.')
    }

    // Save to database if conversationId provided
    if (conversationId) {
      // Save user question
      await insert(
        'INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3)',
        [conversationId, 'user', question]
      )

      // Save assistant response with query
      await insert(
        'INSERT INTO messages (conversation_id, role, content, sql_query) VALUES ($1, $2, $3, $4)',
        [conversationId, 'assistant', parsed.message.trim(), parsed.query.trim()]
      )

      // Update conversation's updated_at timestamp
      await insert(
        'UPDATE conversations SET updated_at = NOW() WHERE id = $1',
        [conversationId]
      )
    }

    res.json({
      message: parsed.message.trim(),
      query: parsed.query.trim(),
    })
  } catch (err) {
    console.error('Query error:', err)
    res.status(500).json({ error: err.message })
  }
})

/**
 * POST /api/explain - Explain a SQL query
 *
 * Protected: requires valid JWT token
 *
 * Request body:
 * {
 *   "query": "SELECT * FROM users",
 *   "schema": [...],
 *   "dialect": "PostgreSQL",
 *   "conversationHistory": [...],
 *   "conversationId": "..." (optional)
 * }
 */
router.post('/explain', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.user
    const { query, schema, dialect, conversationHistory, conversationId } = req.body

    if (!query || !schema || !dialect) {
      return res.status(400).json({ error: 'Missing required fields: query, schema, dialect' })
    }

    // Verify conversation if provided
    if (conversationId) {
      const conversation = await getOne(
        'SELECT id FROM conversations WHERE id = $1 AND user_id = $2',
        [conversationId, userId]
      )
      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found or not authorized' })
      }
    }

    const schemaDDL = schemaToContext(schema, dialect)

    const systemPrompt = [
      'You are a SQL expert explaining queries to non-technical users.',
      'Explain the given SQL query in clear, simple language.',
      'Break down what each part does.',
      'Explain the business logic and intent.',
      'Do not return JSON, just a clear explanation.',
    ].join(' ')

    const userPrompt = [
      `Please explain this SQL query:\n\n${query}`,
      `\nSchema context:\n${schemaDDL}`,
    ].join('\n\n')

    const messagesArray = [
      { role: 'system', content: systemPrompt },
      ...(conversationHistory || []),
      { role: 'user', content: userPrompt },
    ]

    const explanation = await callGroq(messagesArray, { temperature: 0.7, returnJson: false })

    // Save to database if conversationId provided
    if (conversationId) {
      await insert(
        'INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3)',
        [conversationId, 'user', `Explain: ${query}`]
      )

      await insert(
        'INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3)',
        [conversationId, 'assistant', explanation.trim()]
      )

      // Update conversation timestamp
      await insert(
        'UPDATE conversations SET updated_at = NOW() WHERE id = $1',
        [conversationId]
      )
    }

    res.json({
      explanation: explanation.trim(),
    })
  } catch (err) {
    console.error('Explain error:', err)
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
