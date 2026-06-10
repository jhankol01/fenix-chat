import { query } from '../config/database.js'

const Wallet = {
  /**
   * Get or create wallet for a user, returns balance + streak info
   */
  async getBalance(userId) {
    const result = await query(
      `INSERT INTO user_wallets (user_id)
       VALUES ($1)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId]
    )
    const wallet = await query(
      `SELECT user_id, balance, total_earned, streak_days, last_story_date, created_at
       FROM user_wallets WHERE user_id = $1`,
      [userId]
    )
    return wallet.rows[0] || null
  },

  /**
   * Add coins to user wallet with reason logging
   */
  async addCoins(userId, amount, reason, storyId = null) {
    // Upsert wallet
    await query(
      `INSERT INTO user_wallets (user_id, balance, total_earned)
       VALUES ($1, $2, $2)
       ON CONFLICT (user_id) DO UPDATE
       SET balance = user_wallets.balance + $2,
           total_earned = user_wallets.total_earned + $2`,
      [userId, amount]
    )

    // Log transaction
    const result = await query(
      `INSERT INTO coin_transactions (user_id, amount, reason, story_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [userId, amount, reason, storyId]
    )
    return result.rows[0]
  },

  /**
   * Get transaction history for a user
   */
  async getTransactions(userId, limit = 50) {
    const result = await query(
      `SELECT ct.*, s.content AS story_content, s.type AS story_type
       FROM coin_transactions ct
       LEFT JOIN stories s ON s.id = ct.story_id
       WHERE ct.user_id = $1
       ORDER BY ct.created_at DESC
       LIMIT $2`,
      [userId, limit]
    )
    return result.rows
  },

  /**
   * Get top creators leaderboard by total_earned
   */
  async getLeaderboard(limit = 10) {
    const result = await query(
      `SELECT w.user_id, w.balance, w.total_earned, w.streak_days,
              u.username, u.display_name, u.avatar_url
       FROM user_wallets w
       JOIN users u ON u.id = w.user_id
       WHERE w.total_earned > 0
       ORDER BY w.total_earned DESC
       LIMIT $1`,
      [limit]
    )
    return result.rows
  },

  /**
   * Get creator stats for a user (total views, total reactions, streak)
   */
  async getCreatorStats(userId) {
    // Total views across all user's stories
    const viewsResult = await query(
      `SELECT COUNT(*) AS total_views
       FROM story_views sv
       JOIN stories s ON s.id = sv.story_id
       WHERE s.user_id = $1`,
      [userId]
    )

    // Total reactions across all user's stories
    const reactionsResult = await query(
      `SELECT COALESCE(SUM(s.reaction_count), 0) AS total_reactions
       FROM stories s
       WHERE s.user_id = $1`,
      [userId]
    )

    // Wallet info (streak, total earned)
    const walletResult = await query(
      `SELECT balance, total_earned, streak_days, last_story_date
       FROM user_wallets
       WHERE user_id = $1`,
      [userId]
    )

    const wallet = walletResult.rows[0] || { balance: 0, total_earned: 0, streak_days: 0, last_story_date: null }

    return {
      total_views: parseInt(viewsResult.rows[0].total_views) || 0,
      total_reactions: parseInt(reactionsResult.rows[0].total_reactions) || 0,
      balance: wallet.balance,
      total_earned: wallet.total_earned,
      streak_days: wallet.streak_days,
      last_story_date: wallet.last_story_date,
    }
  },

  /**
   * Update streak info for a user
   */
  async updateStreak(userId, streakDays, lastStoryDate) {
    await query(
      `UPDATE user_wallets
       SET streak_days = $2, last_story_date = $3
       WHERE user_id = $1`,
      [userId, streakDays, lastStoryDate]
    )
  },
}

export default Wallet
