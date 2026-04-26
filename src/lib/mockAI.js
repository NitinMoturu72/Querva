import { schemaToContext } from '../../shared/schemaUtils.js'

const API_BASE = 'http://localhost:5000/api'

/**
 * Helper to get auth token from localStorage
 */
function getAuthToken() {
  return localStorage.getItem('authToken')
}

/**
 * Generate helper headers (includes auth token if available)
 */
function getHeaders() {
  const headers = {
    'Content-Type': 'application/json',
  }

  const token = getAuthToken()
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  return headers
}

export async function generateQuery(question, schema, dialect, conversationHistory = [], conversationId = null) {
  const resp = await fetch(`${API_BASE}/query`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      question,
      schema,
      dialect,
      conversationHistory,
      conversationId, // If provided, will be saved to this conversation
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

export async function explainQuery(query, schema, dialect, conversationHistory = [], conversationId = null) {
  const resp = await fetch(`${API_BASE}/explain`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      query,
      schema,
      dialect,
      conversationHistory,
      conversationId,
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

/**
 * Create a new conversation
 */
export async function createConversation(name, dialect, schema) {
  const resp = await fetch(`${API_BASE}/conversations`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      name,
      dialect,
      schema,
    }),
  })

  if (!resp.ok) {
    const err = await resp.json()
    throw new Error(err.error || 'Failed to create conversation')
  }

  const data = await resp.json()
  return data.conversation
}

/**
 * Get all conversations for user
 */
export async function getConversations() {
  const resp = await fetch(`${API_BASE}/conversations`, {
    method: 'GET',
    headers: getHeaders(),
  })

  if (!resp.ok) {
    const err = await resp.json()
    throw new Error(err.error || 'Failed to fetch conversations')
  }

  const data = await resp.json()
  return data.conversations
}

/**
 * Get single conversation with messages and schema
 */
export async function getConversation(conversationId) {
  const resp = await fetch(`${API_BASE}/conversations/${conversationId}`, {
    method: 'GET',
    headers: getHeaders(),
  })

  if (!resp.ok) {
    const err = await resp.json()
    throw new Error(err.error || 'Failed to fetch conversation')
  }

  const data = await resp.json()
  return data
}

export function exportSchemaAsSQL(schema, dialect) {
  return schemaToContext(schema, dialect)
}
