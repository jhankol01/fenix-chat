import { query } from '../config/database.js'

const VIEW_MILESTONES = [
  { views: 100, coins: 10 },
  { views: 200, coins: 20 },
  { views: 500, coins: 50 },
  { views: 1000, coins: 100 },
]

const STREAK_BONUS_DAYS = 7
const STREAK_BONUS_COINS = 20
const DAILY_POST_COINS = 5

/**
 * Grant coins to a user — upserts wallet + logs transaction
 */
async function grantCoins(userId, amount, reason, storyId = null) {
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
  await query(
    `INSERT INTO coin_transactions (user_id, amount, reason, story_id)
     VALUES ($1, $2, $3, $4)`,
    [userId, amount, reason, storyId]
  )
}

/**
 * Check if a story has hit a view milestone and reward the owner.
 * Called every time a story is viewed.
 */
async function checkAndRewardViews(storyId) {
  // Get view count for this story
  const viewResult = await query(
    'SELECT COUNT(*) AS view_count FROM story_views WHERE story_id = $1',
    [storyId]
  )
  const viewCount = parseInt(viewResult.rows[0].view_count) || 0

  // Get story owner
  const storyResult = await query(
    'SELECT user_id FROM stories WHERE id = $1',
    [storyId]
  )
  if (!storyResult.rows[0]) return

  const ownerId = storyResult.rows[0].user_id

  for (const milestone of VIEW_MILESTONES) {
    if (viewCount >= milestone.views) {
      // Check if this milestone was already rewarded
      const existing = await query(
        `SELECT id FROM coin_transactions
         WHERE story_id = $1 AND user_id = $2 AND reason = $3`,
        [storyId, ownerId, `views_${milestone.views}`]
      )

      if (existing.rows.length === 0) {
        await grantCoins(
          ownerId,
          milestone.coins,
          `views_${milestone.views}`,
          storyId
        )
      }
    }
  }
}

/**
 * Check and update daily streak when a user creates a story.
 * Grants daily post bonus + streak bonus at 7-day streak.
 */
async function checkDailyStreak(userId) {
  // Ensure wallet exists
  await query(
    `INSERT INTO user_wallets (user_id)
     VALUES ($1)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  )

  const walletResult = await query(
    'SELECT streak_days, last_story_date FROM user_wallets WHERE user_id = $1',
    [userId]
  )
  const wallet = walletResult.rows[0]
  const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD

  // If already posted today, don't double-reward
  if (wallet.last_story_date) {
    const lastDate = new Date(wallet.last_story_date).toISOString().split('T')[0]
    if (lastDate === today) return
  }

  // Grant daily post coins
  await grantCoins(userId, DAILY_POST_COINS, 'daily_post')

  // Calculate streak
  let newStreak = 1
  if (wallet.last_story_date) {
    const lastDate = new Date(wallet.last_story_date)
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split('T')[0]
    const lastDateStr = lastDate.toISOString().split('T')[0]

    if (lastDateStr === yesterdayStr) {
      // Posted yesterday — continue streak
      newStreak = (wallet.streak_days || 0) + 1
    }
    // else streak resets to 1
  }

  // Update streak
  await query(
    `UPDATE user_wallets
     SET streak_days = $2, last_story_date = $3
     WHERE user_id = $1`,
    [userId, newStreak, today]
  )

  // Check for 7-day streak bonus
  if (newStreak > 0 && newStreak % STREAK_BONUS_DAYS === 0) {
    await grantCoins(userId, STREAK_BONUS_COINS, 'streak_bonus_7day')
  }
}

export { checkAndRewardViews, checkDailyStreak, grantCoins }
