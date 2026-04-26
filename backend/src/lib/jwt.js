const jwt = require('jsonwebtoken')

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production'
const JWT_EXPIRY = '7d'
const REFRESH_TOKEN_EXPIRY = '30d'

/**
 * Generate JWT token
 * This is what gets sent to the frontend after login
 *
 * The token contains:
 * - userId: identifies which user this token belongs to
 * - iat: issued at time
 * - exp: expiration time (7 days from now)
 */
function generateAccessToken(userId) {
  return jwt.sign(
    { userId },              // Payload (data stored in token)
    JWT_SECRET,              // Secret key (used to sign & verify)
    { expiresIn: JWT_EXPIRY } // Options
  )
}

/**
 * Generate refresh token (longer-lived token)
 * Used to get a new access token when the current one expires
 */
function generateRefreshToken(userId) {
  return jwt.sign(
    { userId, type: 'refresh' },
    JWT_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  )
}

/**
 * Verify JWT token
 * Called on every protected request to confirm token is valid
 *
 * If valid: returns the decoded payload { userId, iat, exp }
 * If invalid/expired: throws error
 */
function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    return decoded
  } catch (err) {
    throw new Error(`Invalid token: ${err.message}`)
  }
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
}
