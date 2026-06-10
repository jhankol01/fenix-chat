import { query } from '../config/database.js'

// GET /api/admin/users - List all users (admin view with full data)
export async function listUsers(req, res, next) {
  try {
    const result = await query(
      `SELECT id, username, email, password_hash, display_name, avatar_url, status_text, status_emoji, is_verified, created_at, updated_at
       FROM users
       ORDER BY created_at DESC`
    )
    res.json({ users: result.rows, total: result.rows.length })
  } catch (err) {
    next(err)
  }
}

// Helper: run a query safely, returning a default value if the table doesn't exist
async function safeQuery(sql, params = [], defaultValue = { rows: [{ count: 0 }] }) {
  try {
    return await query(sql, params)
  } catch {
    return defaultValue
  }
}

// GET /api/admin/stats - Comprehensive admin dashboard stats
export async function getStats(req, res, next) {
  try {
    const [
      // Existing counts
      usersResult,
      verifiedResult,
      convResult,
      msgResult,

      // Activity
      activeUsersTodayResult,
      activeUsersWeekResult,
      messagesTodayResult,
      messagesWeekResult,

      // Stories
      totalStoriesResult,
      activeStoriesResult,
      totalStoryViewsResult,

      // Economy
      totalCoinsResult,
      totalEarnedResult,
      totalTransactionsResult,

      // Growth
      newUsersTodayResult,
      newUsersWeekResult,
      newUsersMonthResult,

      // Top users (most messages)
      topUsersResult,

      // Recent signups
      recentUsersResult,

      // Messages per day (last 7 days)
      messagesByDayResult,

      // Users per day (last 7 days)
      usersByDayResult,
    ] = await Promise.all([
      // --- Existing counts ---
      safeQuery('SELECT COUNT(*) AS count FROM users'),
      safeQuery('SELECT COUNT(*) AS count FROM users WHERE is_verified = true'),
      safeQuery('SELECT COUNT(*) AS count FROM conversations'),
      safeQuery('SELECT COUNT(*) AS count FROM messages'),

      // --- Activity ---
      safeQuery(
        `SELECT COUNT(DISTINCT sender_id) AS count FROM messages
         WHERE created_at > NOW() - INTERVAL '24 hours'`
      ),
      safeQuery(
        `SELECT COUNT(DISTINCT sender_id) AS count FROM messages
         WHERE created_at > NOW() - INTERVAL '7 days'`
      ),
      safeQuery(
        `SELECT COUNT(*) AS count FROM messages
         WHERE created_at > NOW() - INTERVAL '24 hours'`
      ),
      safeQuery(
        `SELECT COUNT(*) AS count FROM messages
         WHERE created_at > NOW() - INTERVAL '7 days'`
      ),

      // --- Stories ---
      safeQuery('SELECT COUNT(*) AS count FROM stories'),
      safeQuery('SELECT COUNT(*) AS count FROM stories WHERE expires_at > NOW()'),
      safeQuery('SELECT COUNT(*) AS count FROM story_views'),

      // --- Economy ---
      safeQuery(
        'SELECT COALESCE(SUM(balance), 0) AS total FROM user_wallets',
        [],
        { rows: [{ total: 0 }] }
      ),
      safeQuery(
        'SELECT COALESCE(SUM(total_earned), 0) AS total FROM user_wallets',
        [],
        { rows: [{ total: 0 }] }
      ),
      safeQuery('SELECT COUNT(*) AS count FROM coin_transactions'),

      // --- Growth ---
      safeQuery(
        `SELECT COUNT(*) AS count FROM users
         WHERE created_at > NOW() - INTERVAL '24 hours'`
      ),
      safeQuery(
        `SELECT COUNT(*) AS count FROM users
         WHERE created_at > NOW() - INTERVAL '7 days'`
      ),
      safeQuery(
        `SELECT COUNT(*) AS count FROM users
         WHERE created_at > NOW() - INTERVAL '30 days'`
      ),

      // --- Top 5 users by message count ---
      safeQuery(
        `SELECT u.username, u.display_name, u.avatar_url, COUNT(m.id) AS message_count
         FROM messages m
         JOIN users u ON u.id = m.sender_id
         GROUP BY u.id, u.username, u.display_name, u.avatar_url
         ORDER BY message_count DESC
         LIMIT 5`,
        [],
        { rows: [] }
      ),

      // --- Last 10 signups ---
      safeQuery(
        `SELECT username, display_name, avatar_url, created_at, is_verified
         FROM users
         ORDER BY created_at DESC
         LIMIT 10`,
        [],
        { rows: [] }
      ),

      // --- Messages per day (last 7 days) ---
      safeQuery(
        `SELECT date_trunc('day', created_at)::date AS date, COUNT(*) AS count
         FROM messages
         WHERE created_at > NOW() - INTERVAL '7 days'
         GROUP BY date
         ORDER BY date ASC`,
        [],
        { rows: [] }
      ),

      // --- New users per day (last 7 days) ---
      safeQuery(
        `SELECT date_trunc('day', created_at)::date AS date, COUNT(*) AS count
         FROM users
         WHERE created_at > NOW() - INTERVAL '7 days'
         GROUP BY date
         ORDER BY date ASC`,
        [],
        { rows: [] }
      ),
    ])

    const toInt = (row, field = 'count') => parseInt(row[field]) || 0

    res.json({
      // Existing
      totalUsers: toInt(usersResult.rows[0]),
      verifiedUsers: toInt(verifiedResult.rows[0]),
      totalConversations: toInt(convResult.rows[0]),
      totalMessages: toInt(msgResult.rows[0]),

      // Activity
      activeUsersToday: toInt(activeUsersTodayResult.rows[0]),
      activeUsersWeek: toInt(activeUsersWeekResult.rows[0]),
      messagesToday: toInt(messagesTodayResult.rows[0]),
      messagesWeek: toInt(messagesWeekResult.rows[0]),

      // Stories
      totalStories: toInt(totalStoriesResult.rows[0]),
      activeStories: toInt(activeStoriesResult.rows[0]),
      totalStoryViews: toInt(totalStoryViewsResult.rows[0]),

      // Economy
      totalCoinsCirculating: parseFloat(totalCoinsResult.rows[0].total) || 0,
      totalCoinsEverEarned: parseFloat(totalEarnedResult.rows[0].total) || 0,
      totalTransactions: toInt(totalTransactionsResult.rows[0]),

      // Growth
      newUsersToday: toInt(newUsersTodayResult.rows[0]),
      newUsersWeek: toInt(newUsersWeekResult.rows[0]),
      newUsersMonth: toInt(newUsersMonthResult.rows[0]),

      // Top users
      topUsers: topUsersResult.rows.map(r => ({
        username: r.username,
        display_name: r.display_name,
        avatar_url: r.avatar_url,
        message_count: toInt(r, 'message_count'),
      })),

      // Recent signups
      recentUsers: recentUsersResult.rows.map(r => ({
        username: r.username,
        display_name: r.display_name,
        avatar_url: r.avatar_url,
        created_at: r.created_at,
        is_verified: r.is_verified,
      })),

      // Chart data
      messagesByDay: messagesByDayResult.rows.map(r => ({
        date: r.date,
        count: toInt(r),
      })),
      usersByDay: usersByDayResult.rows.map(r => ({
        date: r.date,
        count: toInt(r),
      })),
    })
  } catch (err) {
    next(err)
  }
}
