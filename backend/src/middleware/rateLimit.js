const { getOne, insert } = require('../lib/dbUtils')

const REQUEST_LIMIT = 5    // requests per minute per user
const TOKEN_LIMIT   = 6000 // tokens per minute per user

async function rateLimitMiddleware(req, res, next) {
  // Guests are not rate-limited (no account to track)
  if (!req.user) return next()

  const { userId } = req.user

  try {
    // Sliding window: look at the last 60 seconds
    const [reqRow, tokenRow] = await Promise.all([
      getOne(
        `SELECT COUNT(*)::INTEGER AS count
         FROM rate_limit_log
         WHERE user_id = $1 AND created_at > NOW() - INTERVAL '1 minute'`,
        [userId]
      ),
      getOne(
        `SELECT COALESCE(SUM(tokens_used), 0)::INTEGER AS total
         FROM rate_limit_log
         WHERE user_id = $1 AND created_at > NOW() - INTERVAL '1 minute'`,
        [userId]
      ),
    ])

    if (reqRow.count >= REQUEST_LIMIT) {
      return res.status(429).json({
        error: 'Rate limit reached. You can send 5 requests per minute.',
        retryAfter: 60,
      })
    }

    if (tokenRow.total >= TOKEN_LIMIT) {
      return res.status(429).json({
        error: 'Token limit reached. Please wait a moment before sending another request.',
        retryAfter: 60,
      })
    }

    // Attach a helper the route calls after getting the Groq token count
    req.logUsage = async (tokensUsed, endpoint) => {
      await insert(
        'INSERT INTO rate_limit_log (user_id, endpoint, tokens_used) VALUES ($1, $2, $3)',
        [userId, endpoint, tokensUsed]
      )
    }

    next()
  } catch (err) {
    console.error('Rate limit check error:', err)
    next() // fail open — don't block the user if the check itself errors
  }
}

module.exports = { rateLimitMiddleware }
