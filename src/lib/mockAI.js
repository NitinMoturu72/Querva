import { schemaToContext } from '../../shared/schemaUtils.js'

const API_BASE = 'http://localhost:5000/api'

export async function generateQuery(question, schema, dialect, conversationHistory = []) {
  const resp = await fetch(`${API_BASE}/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      question,
      schema,
      dialect,
      conversationHistory,
    }),
  })

  if (!resp.ok) {
    let message = `API error (${resp.status})`
    try {
      const err = await resp.json()
      if (err.error) message = err.error
    } catch { /* ignore */ }
    throw new Error(message)
  }

  const data = await resp.json()
  return {
    message: data.message,
    query: data.query,
  }
}

export async function explainQuery(query, schema, dialect, conversationHistory = []) {
  const resp = await fetch(`${API_BASE}/explain`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      schema,
      dialect,
      conversationHistory,
    }),
  })

  if (!resp.ok) {
    let message = `API error (${resp.status})`
    try {
      const err = await resp.json()
      if (err.error) message = err.error
    } catch { /* ignore */ }
    throw new Error(message)
  }

  const data = await resp.json()
  return data.explanation
}

export function exportSchemaAsSQL(schema, dialect) {
  return schemaToContext(schema, dialect)
}
