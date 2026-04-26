const pool = require('../lib/db')

/**
 * Setup: Create test tables if they don't exist
 */
async function setupTestDatabase() {
  try {
    // Users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)

    // Conversations table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        dialect VARCHAR(50),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)

    // Schema tables
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_tables (
        id SERIAL PRIMARY KEY,
        conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        sort_order INTEGER DEFAULT 0
      )
    `)

    // Columns table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS columns (
        id SERIAL PRIMARY KEY,
        table_id INTEGER NOT NULL REFERENCES schema_tables(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(255) NOT NULL,
        nullable BOOLEAN DEFAULT true,
        key_type VARCHAR(50) DEFAULT 'none',
        default_val VARCHAR(255)
      )
    `)

    // Column references (FK)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS column_references (
        id SERIAL PRIMARY KEY,
        column_id INTEGER NOT NULL REFERENCES columns(id) ON DELETE CASCADE,
        referenced_table VARCHAR(255) NOT NULL,
        referenced_column VARCHAR(255) NOT NULL
      )
    `)

    // Messages table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        role VARCHAR(50) NOT NULL,
        content TEXT,
        sql_query TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)

    // Rate limit log
    await pool.query(`
      CREATE TABLE IF NOT EXISTS rate_limit_log (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        endpoint VARCHAR(255),
        tokens_used INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)

    console.log('Test database tables created')
  } catch (err) {
    console.error('Failed to setup test database:', err)
    throw err
  }
}

/**
 * Teardown: Clear test data
 */
async function teardownTestDatabase() {
  try {
    // Clear all test data (cascade will handle related tables)
    await pool.query('TRUNCATE rate_limit_log CASCADE')
    await pool.query('TRUNCATE messages CASCADE')
    await pool.query('TRUNCATE column_references CASCADE')
    await pool.query('TRUNCATE columns CASCADE')
    await pool.query('TRUNCATE schema_tables CASCADE')
    await pool.query('TRUNCATE conversations CASCADE')
    await pool.query('TRUNCATE users CASCADE')
    console.log('Test database cleared')
  } catch (err) {
    console.error('Failed to teardown test database:', err)
    throw err
  }
}

/**
 * Close connection pool
 */
async function closeTestDatabase() {
  try {
    await pool.end()
    console.log('Database connection closed')
  } catch (err) {
    console.error('Failed to close database:', err)
    throw err
  }
}

module.exports = {
  setupTestDatabase,
  teardownTestDatabase,
  closeTestDatabase,
  pool,
}
