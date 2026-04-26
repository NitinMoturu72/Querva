require('dotenv').config({ path: require('path').join(__dirname, '../../.env') })
const { Pool } = require('pg')

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
})

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err)
})

console.log(`Connecting to PostgreSQL: ${process.env.DB_USER}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`)

module.exports = pool
