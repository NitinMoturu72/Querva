const express = require('express')
const { schemaToContext, extractJsonObject, callGroq } = require('../lib/groq')

const router = express.Router()

// POST /api/query - Generate SQL query
router.post('/query', async (req, res) => {
  try {
    const { question, schema, dialect, conversationHistory } = req.body

    if (!question || !schema || !dialect) {
      return res.status(400).json({ error: 'Missing required fields: question, schema, dialect' })
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

    res.json({
      message: parsed.message.trim(),
      query: parsed.query.trim(),
    })
  } catch (err) {
    console.error('Query error:', err)
    res.status(500).json({ error: err.message })
  }
})

// POST /api/explain - Explain a SQL query
router.post('/explain', async (req, res) => {
  try {
    const { query, schema, dialect, conversationHistory } = req.body

    if (!query || !schema || !dialect) {
      return res.status(400).json({ error: 'Missing required fields: query, schema, dialect' })
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

    res.json({
      explanation: explanation.trim(),
    })
  } catch (err) {
    console.error('Explain error:', err)
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
