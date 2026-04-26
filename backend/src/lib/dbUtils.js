const pool = require('./db')

/**
 * Execute a query and return results
 */
async function query(sql, params = []) {
  try {
    const result = await pool.query(sql, params)
    return result
  } catch (err) {
    console.error('Database query error:', err)
    throw err
  }
}

/**
 * Get a single row
 */
async function getOne(sql, params = []) {
  const result = await query(sql, params)
  return result.rows[0] || null
}

/**
 * Get multiple rows
 */
async function getAll(sql, params = []) {
  const result = await query(sql, params)
  return result.rows
}

/**
 * Run an insert and return the new row
 */
async function insert(sql, params = []) {
  const result = await query(sql, params)
  return result.rows[0] || null
}

/**
 * Run an update/delete and return affected rows count
 */
async function execute(sql, params = []) {
  const result = await query(sql, params)
  return result.rowCount
}

module.exports = {
  query,
  getOne,
  getAll,
  insert,
  execute,
}
