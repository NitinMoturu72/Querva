const express = require('express')
const { authMiddleware } = require('../middleware/auth')
const { getOne, getAll } = require('../lib/dbUtils')

const router = express.Router()

/**
 * GET /api/admin/metrics
 *
 * Admin-only endpoint showing application usage metrics
 * Protected: requires valid JWT token
 *
 * Response shows:
 * - Total users registered
 * - Active users (logged in within last 7 days)
 * - Total conversations
 * - Total messages
 * - Messages per day average
 */
router.get('/metrics', authMiddleware, async (req, res) => {
  try {
    // Get total users
    const totalUsersResult = await getOne('SELECT COUNT(*) as count FROM users')
    const totalUsers = totalUsersResult.count

    // Get active users (logged in within last 7 days - via refresh tokens)
    const activeUsersResult = await getOne(
      'SELECT COUNT(DISTINCT user_id) as count FROM refresh_tokens WHERE created_at > NOW() - INTERVAL \'7 days\''
    )
    const activeUsers = activeUsersResult.count

    // Get total conversations
    const totalConversationsResult = await getOne('SELECT COUNT(*) as count FROM conversations')
    const totalConversations = totalConversationsResult.count

    // Get total messages
    const totalMessagesResult = await getOne('SELECT COUNT(*) as count FROM messages')
    const totalMessages = totalMessagesResult.count

    // Get messages per day (average)
    const messagesPerDayResult = await getOne(
      `SELECT AVG(daily_count)::INTEGER as avg_messages_per_day
       FROM (
         SELECT COUNT(*) as daily_count
         FROM messages
         WHERE created_at > NOW() - INTERVAL '30 days'
         GROUP BY DATE(created_at)
       ) daily_stats`
    )
    const messagesPerDay = messagesPerDayResult.avg_messages_per_day || 0

    // Get queries generated (messages with sql_query)
    const queriesResult = await getOne(
      'SELECT COUNT(*) as count FROM messages WHERE sql_query IS NOT NULL'
    )
    const queriesGenerated = queriesResult.count

    // Get user signup trend (last 7 days)
    const signupTrendResult = await getAll(
      `SELECT DATE(created_at) as date, COUNT(*) as count
       FROM users
       WHERE created_at > NOW() - INTERVAL '7 days'
       GROUP BY DATE(created_at)
       ORDER BY date DESC`
    )

    res.json({
      metrics: {
        totalUsers,
        activeUsers,
        totalConversations,
        totalMessages,
        queriesGenerated,
        messagesPerDay,
        signupTrend: signupTrendResult,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    console.error('Metrics error:', err)
    res.status(500).json({ error: 'Failed to fetch metrics' })
  }
})

module.exports = router
