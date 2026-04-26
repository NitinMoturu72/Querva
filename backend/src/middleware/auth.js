const { verifyToken } = require('../lib/jwt')

/**
 * Middleware to check if request has valid JWT token
 *
 * Flow:
 * 1. Extract token from Authorization header: "Bearer <token>"
 * 2. Verify token is valid
 * 3. If valid: attach userId to req.user, call next()
 * 4. If invalid: return 401 error
 *
 * Usage in routes: router.post('/protected-endpoint', authMiddleware, handler)
 */
function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization

    // Check if Authorization header exists
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' })
    }

    // Extract token from "Bearer <token>"
    const token = authHeader.slice(7)

    // Verify token and get userId
    const decoded = verifyToken(token)

    // Attach user info to request so handlers can access it
    req.user = {
      userId: decoded.userId
    }

    next()
  } catch (err) {
    console.error('Auth error:', err)
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}

module.exports = {
  authMiddleware,
}
