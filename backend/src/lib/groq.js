const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const GROQ_MODEL = 'llama-3.3-70b-versatile'

function schemaToContext(schema, dialect) {
  return schema.map(table => {
    const cols = table.columns.map(c => {
      const parts = [`  ${c.name} ${c.type}`]
      if (c.key === 'PK') parts.push('PRIMARY KEY')
      if (!c.nullable) parts.push('NOT NULL')
      if (c.default) parts.push(`DEFAULT ${c.default}`)
      if (c.key === 'FK' && c.references) parts.push(`REFERENCES ${c.references.table}(${c.references.column})`)
      return parts.join(' ')
    }).join(',\n')
    return `CREATE TABLE ${table.name} (\n${cols}\n);`
  }).join('\n\n')
}

function extractJsonObject(text) {
  if (!text) return null
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null
  try {
    return JSON.parse(text.slice(start, end + 1))
  } catch {
    return null
  }
}

/**
 * Call Groq API with support for both JSON and plain text responses
 */
async function callGroq(messages, options = {}) {
  const { temperature = 0.2, returnJson = true } = options
  const apiKey = process.env.GROQ_API_KEY

  if (!apiKey) {
    throw new Error('GROQ_API_KEY not set in environment variables')
  }

  const body = {
    model: GROQ_MODEL,
    temperature,
    messages,
  }

  if (returnJson) {
    body.response_format = { type: 'json_object' }
  }

  const resp = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!resp.ok) {
    let message = `Groq API error (${resp.status})`
    try {
      const err = await resp.json()
      if (err?.error?.message) message = err.error.message
    } catch {
      // ignore
    }
    throw new Error(message)
  }

  const data = await resp.json()
  const content = data?.choices?.[0]?.message?.content
  if (!content) throw new Error('Groq returned an empty response.')

  const tokensUsed = data?.usage?.total_tokens ?? 0
  return { content, tokensUsed }
}

module.exports = {
  schemaToContext,
  extractJsonObject,
  callGroq,
}
