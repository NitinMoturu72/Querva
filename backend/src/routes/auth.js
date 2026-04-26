const express = require('express')
const { getOne, insert, execute } = require('../lib/dbUtils')
const { hashPassword, verifyPassword } = require('../lib/password')
const { generateAccessToken, generateRefreshToken } = require('../lib/jwt')
const { authMiddleware } = require('../middleware/auth')

const router = express.Router()

/**
 * POST /api/auth/register
 *
 * Create new user account
 *
 * Request body:
 * {
 *   "email": "user@example.com",
 *   "password": "password123",
 *   "name": "John Doe"
 * }
 *
 * Response:
 * {
 *   "user": { "id": "...", "email": "...", "name": "..." },
 *   "token": "eyJhbGc..." (JWT)
 * }
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' })
    }

    // Check if user already exists
    const existingUser = await getOne('SELECT id FROM users WHERE email = $1', [email])
    if (existingUser) {
      return res.status(409).json({ error: 'Email already registered' })
    }

    // Hash password before storing
    const hashedPassword = await hashPassword(password)

    // Insert new user into database
    const newUser = await insert(
      'INSERT INTO users (email, password, name) VALUES ($1, $2, $3) RETURNING id, email, name, created_at',
      [email, hashedPassword, name || email]
    )

    // Generate JWT token (valid for 7 days)
    const token = generateAccessToken(newUser.id)

    res.status(201).json({
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
      },
      token,
    })
  } catch (err) {
    console.error('Register error:', err)
    res.status(500).json({ error: 'Registration failed' })
  }
})

/**
 * POST /api/auth/login
 *
 * Authenticate user and return JWT token
 *
 * Request body:
 * {
 *   "email": "user@example.com",
 *   "password": "password123"
 * }
 *
 * Response:
 * {
 *   "user": { "id": "...", "email": "...", "name": "..." },
 *   "token": "eyJhbGc..." (JWT)
 * }
 *
 * Process:
 * 1. Find user by email
 * 2. Compare password with hashed password
 * 3. If match: generate and return token
 * 4. If no match: return 401 Unauthorized
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' })
    }

    // Find user by email
    const user = await getOne('SELECT id, email, name, password FROM users WHERE email = $1', [email])

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    // Verify password matches the hashed password in DB
    const passwordMatch = await verifyPassword(password, user.password)

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    // Generate JWT token
    const token = generateAccessToken(user.id)

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      token,
    })
  } catch (err) {
    console.error('Login error:', err)
    res.status(500).json({ error: 'Login failed' })
  }
})

/**
 * GET /api/auth/me
 *
 * Get current user info (requires valid token)
 *
 * Request headers:
 * Authorization: Bearer <token>
 *
 * Response:
 * {
 *   "user": { "id": "...", "email": "...", "name": "..." }
 * }
 */
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await getOne(
      'SELECT id, email, name FROM users WHERE id = $1',
      [req.user.userId]
    )
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }
    res.json({ user: { id: user.id, email: user.email, name: user.name } })
  } catch (err) {
    console.error('Me error:', err)
    res.status(500).json({ error: 'Failed to get user' })
  }
})

module.exports = router
