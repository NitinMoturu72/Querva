require('dotenv').config()
const path = require('path')
const express = require('express')
const cors = require('cors')
const pool = require('./lib/db')
const apiRoutes = require('./routes/api')
const authRoutes = require('./routes/auth')
const conversationRoutes = require('./routes/conversations')
const adminRoutes = require('./routes/admin')

const app = express()
const PORT = process.env.PORT || 5000

// Middleware
app.use(cors({
  origin: 'http://localhost:5173', // Vite dev server default port
  credentials: true,
}))
app.use(express.json())

// Health check with DB verification
app.get('/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()')
    res.json({
      status: 'ok',
      database: 'connected',
      timestamp: result.rows[0].now
    })
  } catch (err) {
    console.error('Database connection error:', err)
    res.status(500).json({
      status: 'error',
      database: 'disconnected',
      error: err.message
    })
  }
})

// API routes
app.use('/api/auth', authRoutes)
app.use('/api/conversations', conversationRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api', apiRoutes)

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ error: 'Internal server error' })
})

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' })
})

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
  console.log(`Test database: http://localhost:${PORT}/health`)
})
