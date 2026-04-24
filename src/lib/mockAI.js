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

export async function generateQuery(question, schema, dialect) {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY
  if (!apiKey) {
    throw new Error('No Groq API key found. Add VITE_GROQ_API_KEY to your .env file and restart Vite.')
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

  const resp = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  })

  if (!resp.ok) {
    let message = `Groq API error (${resp.status})`
    try {
      const err = await resp.json()
      const detail = err?.error?.message
      if (detail) message = detail
    } catch { /* ignore */ }
    throw new Error(message)
  }

  const data = await resp.json()
  const content = data?.choices?.[0]?.message?.content
  if (!content) throw new Error('Groq returned an empty response.')

  const parsed = extractJsonObject(content)
  if (!parsed || typeof parsed.message !== 'string' || typeof parsed.query !== 'string') {
    throw new Error('Groq response was not valid JSON with message and query fields.')
  }

  return {
    message: parsed.message.trim(),
    query: parsed.query.trim(),
  }
}

export function exportSchemaAsSQL(schema, dialect) {
  return schemaToContext(schema, dialect)
}
