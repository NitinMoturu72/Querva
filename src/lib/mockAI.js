/**
 * Mock AI query generator.
 * Swap generateQuery() for a real Anthropic API call later.
 */

const DELAY = 900 // ms, simulates network

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

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

// Static mock responses keyed to common question patterns
const MOCK_RESPONSES = [
  {
    pattern: /select|get|fetch|find|show|list|all/i,
    response: (schema, dialect, question) => {
      const table = schema[0]
      const cols = table ? table.columns.map(c => c.name).join(', ') : '*'
      const tname = table?.name || 'your_table'
      return {
        message: `Here's a SELECT query to retrieve records from **${tname}**. I've included all columns — you can narrow this down by replacing the column list.`,
        query: `SELECT ${cols}\nFROM ${tname}\nWHERE 1=1  -- add your conditions here\nLIMIT 100;`,
      }
    },
  },
  {
    pattern: /join|relat|connect|link/i,
    response: (schema, dialect, question) => {
      const t1 = schema[0]
      const t2 = schema[1]
      if (!t1 || !t2) return fallback(schema)
      const fkCol = t2?.columns.find(c => c.key === 'FK' && c.references?.table === t1?.name)
      const joinCondition = fkCol
        ? `${t2.name}.${fkCol.name} = ${t1.name}.${fkCol.references.column}`
        : `${t2.name}.${t1.name}_id = ${t1.name}.id`
      return {
        message: `Here's a JOIN between **${t1.name}** and **${t2.name}** using their relationship.`,
        query: `SELECT\n  ${t1.name}.*,\n  ${t2.name}.*\nFROM ${t1.name}\nINNER JOIN ${t2.name}\n  ON ${joinCondition};`,
      }
    },
  },
  {
    pattern: /insert|add|create|new record/i,
    response: (schema, dialect, question) => {
      const table = schema[0]
      if (!table) return fallback(schema)
      const nonPK = table.columns.filter(c => c.key !== 'PK')
      const cols = nonPK.map(c => c.name).join(', ')
      const vals = nonPK.map(c => {
        if (c.type.startsWith('INT') || c.type.startsWith('NUM') || c.type.startsWith('DEC')) return '0'
        if (c.type.startsWith('BOOL')) return 'true'
        if (c.type.includes('DATE') || c.type.includes('TIME')) return `'${new Date().toISOString().split('T')[0]}'`
        return `'value'`
      }).join(', ')
      return {
        message: `Here's an INSERT statement for **${table.name}**. Replace the placeholder values with your actual data.`,
        query: `INSERT INTO ${table.name} (${cols})\nVALUES (${vals});`,
      }
    },
  },
  {
    pattern: /update|edit|change|modify/i,
    response: (schema, dialect, question) => {
      const table = schema[0]
      if (!table) return fallback(schema)
      const pk = table.columns.find(c => c.key === 'PK')
      const nonPK = table.columns.filter(c => c.key !== 'PK').slice(0, 2)
      const setClause = nonPK.map(c => `  ${c.name} = 'new_value'`).join(',\n')
      return {
        message: `Here's an UPDATE for **${table.name}**. Make sure to always include a WHERE clause to avoid updating every row.`,
        query: `UPDATE ${table.name}\nSET\n${setClause}\nWHERE ${pk?.name || 'id'} = 1;  -- specify your condition`,
      }
    },
  },
  {
    pattern: /delete|remove|drop/i,
    response: (schema, dialect, question) => {
      const table = schema[0]
      if (!table) return fallback(schema)
      const pk = table.columns.find(c => c.key === 'PK')
      return {
        message: `Here's a DELETE for **${table.name}**. ⚠️ Always double-check your WHERE clause before running this.`,
        query: `DELETE FROM ${table.name}\nWHERE ${pk?.name || 'id'} = 1;  -- specify your condition`,
      }
    },
  },
  {
    pattern: /count|how many|total|sum|average|avg|group/i,
    response: (schema, dialect, question) => {
      const table = schema[0]
      if (!table) return fallback(schema)
      const numCol = table.columns.find(c => c.type.startsWith('INT') || c.type.startsWith('DEC') || c.type.startsWith('NUM'))
      return {
        message: `Here's an aggregation query on **${table.name}**.`,
        query: numCol
          ? `SELECT\n  COUNT(*) AS total_rows,\n  SUM(${numCol.name}) AS total_${numCol.name},\n  AVG(${numCol.name}) AS avg_${numCol.name}\nFROM ${table.name};`
          : `SELECT COUNT(*) AS total_rows\nFROM ${table.name};`,
      }
    },
  },
]

function fallback(schema) {
  const table = schema[0]
  return {
    message: `I can help with queries on your schema. Here's a basic example — try asking me something more specific like "join users and orders" or "insert a new record into ${table?.name || 'a table'}"`,
    query: `SELECT *\nFROM ${table?.name || 'your_table'}\nLIMIT 10;`,
  }
}

export async function generateQuery(question, schema, dialect) {
  await sleep(DELAY)

  for (const { pattern, response } of MOCK_RESPONSES) {
    if (pattern.test(question)) {
      return response(schema, dialect, question)
    }
  }

  return fallback(schema)
}

export function exportSchemaAsSQL(schema, dialect) {
  return schemaToContext(schema, dialect)
}
