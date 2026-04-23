/**
 * Parses uploaded schema files into a normalized schema array.
 * Schema shape: Array<{ id, name, columns: Array<{ id, name, type, nullable, key, default, references }> }>
 */
 
function makeId() {
  return Math.random().toString(36).slice(2, 9)
}
 
function makeColumn(overrides = {}) {
  return {
    id: makeId(),
    name: '',
    type: 'VARCHAR(255)',
    nullable: true,
    key: 'none',    // 'none' | 'PK' | 'FK' | 'UQ'
    default: '',
    references: null, // { table, column } when key === 'FK'
    ...overrides,
  }
}
 
function makeTable(overrides = {}) {
  return {
    id: makeId(),
    name: 'new_table',
    columns: [],
    ...overrides,
  }
}
 
// ── SQL parser (basic CREATE TABLE support) ──────────────────────────────────
function parseSQL(content) {
  const tables = []
  const createRe = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"']?(\w+)[`"']?\s*\(([\s\S]*?)\n\s*\)\s*;/gi
  let match
 
  while ((match = createRe.exec(content)) !== null) {
    const tableName = match[1]
    const body = match[2]
    const columns = []
 
    const lines = body.split('\n').map(l => l.trim()).filter(Boolean)
    for (const line of lines) {
      // Skip table-level constraints
      if (/^(PRIMARY\s+KEY|UNIQUE|INDEX|KEY|CONSTRAINT|FOREIGN\s+KEY)/i.test(line)) {
        // But try to extract FK relationships
        const fkRe = /FOREIGN\s+KEY\s*\(`?(\w+)`?\)\s*REFERENCES\s*`?(\w+)`?\s*\(`?(\w+)`?\)/i
        const fkMatch = line.match(fkRe)
        if (fkMatch) {
          const col = columns.find(c => c.name === fkMatch[1])
          if (col) {
            col.key = 'FK'
            col.references = { table: fkMatch[2], column: fkMatch[3] }
          }
        }
        continue
      }
 
      const colRe = /^[`"']?(\w+)[`"']?\s+([A-Z]+(?:\([^)]*\))?)/i
      const colMatch = line.match(colRe)
      if (!colMatch) continue
 
      const colName = colMatch[1]
      const colType = colMatch[2].toUpperCase()
 
      const isPK = /PRIMARY\s+KEY/i.test(line)
      const isUnique = /\bUNIQUE\b/i.test(line)
      const isNotNull = /NOT\s+NULL/i.test(line)
      const defaultMatch = line.match(/DEFAULT\s+('[^']*'|[^\s,]+)/i)
      const defaultVal = defaultMatch ? defaultMatch[1].replace(/^'|'$/g, '') : ''
 
      columns.push(makeColumn({
        name: colName,
        type: colType,
        nullable: !isNotNull && !isPK,
        key: isPK ? 'PK' : isUnique ? 'UQ' : 'none',
        default: defaultVal,
      }))
    }
 
    tables.push(makeTable({ name: tableName, columns }))
  }
 
  return tables
}
 
// ── JSON parser ───────────────────────────────────────────────────────────────
function parseJSON(content) {
  const data = JSON.parse(content)
  const tables = []
 
  // Support array of tables or object keyed by table name
  const entries = Array.isArray(data)
    ? data.map(t => [t.name || t.table_name, t.columns || t.fields || []])
    : Object.entries(data).map(([k, v]) => [k, Array.isArray(v) ? v : v.columns || []])
 
  for (const [tableName, cols] of entries) {
    const columns = cols.map(col => {
      const name = col.name || col.column_name || col.field || ''
      const type = (col.type || col.data_type || 'VARCHAR(255)').toUpperCase()
      const nullable = col.nullable !== undefined ? !!col.nullable : col.null !== 'NO'
      const isPK = col.key === 'PK' || col.primary_key || col.primaryKey || false
      const isFK = col.key === 'FK' || !!col.references
      const isUQ = col.key === 'UQ' || col.unique || false
      const key = isPK ? 'PK' : isFK ? 'FK' : isUQ ? 'UQ' : 'none'
      const references = isFK && col.references
        ? { table: col.references.table || col.references, column: col.references.column || 'id' }
        : null
 
      return makeColumn({ name, type, nullable, key, default: col.default || '', references })
    })
    tables.push(makeTable({ name: tableName, columns }))
  }
 
  return tables
}
 
// ── CSV parser ────────────────────────────────────────────────────────────────
// Expected columns: table,column,type,nullable,key,default
 
// Parses a single CSV row respecting quoted fields AND unquoted paren-groups.
// e.g. products,price,DECIMAL(10,2),false,none,, → 7 correct fields
function parseCSVRow(row) {
  const fields = []
  let current = ''
  let inQuotes = false
  let parenDepth = 0
 
  for (let i = 0; i < row.length; i++) {
    const ch = row[i]
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if (!inQuotes && ch === '(') {
      parenDepth++
      current += ch
    } else if (!inQuotes && ch === ')') {
      parenDepth--
      current += ch
    } else if (!inQuotes && parenDepth === 0 && ch === ',') {
      fields.push(current.trim().replace(/^"|"$/g, ''))
      current = ''
    } else {
      current += ch
    }
  }
  fields.push(current.trim().replace(/^"|"$/g, ''))
  return fields
}
 
function parseCSV(content) {
  const lines = content.trim().split('\n')
  const headers = parseCSVRow(lines[0].toLowerCase()).map(h => h.trim())
  const rows = lines.slice(1)
 
  const tableMap = new Map()
 
  for (const row of rows) {
    // Bug fix: naive split(',') breaks types like DECIMAL(10,2) into two fields.
    // Use a proper CSV parser that respects quoted fields, then also
    // re-join any unquoted paren-groups that got split (e.g. DECIMAL(10,2)).
    const values = parseCSVRow(row)
    const get = (key) => {
      const i = headers.indexOf(key)
      return i >= 0 ? values[i] : ''
    }
 
    const tableName = get('table') || get('table_name')
    if (!tableName) continue
 
    if (!tableMap.has(tableName)) {
      tableMap.set(tableName, makeTable({ name: tableName, columns: [] }))
    }
 
    const key = get('key').toUpperCase()
    const refRaw = get('references')
    let references = null
    if (key === 'FK' && refRaw) {
      const [refTable, refCol] = refRaw.split('.').map(s => s.trim())
      references = { table: refTable, column: refCol || 'id' }
    }
 
    tableMap.get(tableName).columns.push(makeColumn({
      name: get('column') || get('column_name'),
      type: (get('type') || 'VARCHAR(255)').toUpperCase(),
      nullable: get('nullable').toLowerCase() !== 'false' && get('nullable') !== '0',
      key: ['PK', 'FK', 'UQ'].includes(key) ? key : 'none',
      default: get('default'),
      references,
    }))
  }
 
  return [...tableMap.values()]
}
 
// ── Public API ────────────────────────────────────────────────────────────────
export async function parseSchemaFile(file) {
  const content = await file.text()
  const ext = file.name.split('.').pop().toLowerCase()
 
  try {
    if (ext === 'sql') return parseSQL(content)
    if (ext === 'json') return parseJSON(content)
    if (ext === 'csv') return parseCSV(content)
    throw new Error(`Unsupported file type: .${ext}`)
  } catch (err) {
    throw new Error(`Failed to parse ${file.name}: ${err.message}`)
  }
}
 
export { makeTable, makeColumn, makeId }
