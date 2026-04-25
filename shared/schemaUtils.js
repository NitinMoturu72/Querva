/**
 * Convert schema object to CREATE TABLE DDL statements
 */
export function schemaToContext(schema, dialect) {
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

/**
 * Extract JSON object from text
 */
export function extractJsonObject(text) {
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
