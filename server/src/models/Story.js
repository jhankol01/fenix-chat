import { query } from '../config/database.js'

const Story = {
  /**
   * Create a new story
   */
  async create({ userId, content, type = 'text', backgroundColor = '#7C3AED', fontSize = 'medium', caption = '' }) {
    const result = await query(
      `INSERT INTO stories (user_id, content, type, background_color, font_size, caption)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [userId, content, type, backgroundColor, fontSize, caption]
    )
    return result.rows[0]
  },

  /**
   * Get all active stories (not expired), grouped by user.
   * Returns users who have stories, with their story list.
   */
  async getAll(viewerId) {
    const result = await query(
      `SELECT s.*, u.username, u.display_name, u.avatar_url,
              EXISTS(SELECT 1 FROM story_views sv WHERE sv.story_id = s.id AND sv.viewer_id = $1) AS viewed
       FROM stories s
       JOIN users u ON u.id = s.user_id
       WHERE s.expires_at > NOW()
       ORDER BY s.user_id, s.created_at ASC`,
      [viewerId]
    )
    return result.rows
  },

  /**
   * Get stories by a specific user
   */
  async getByUser(userId, viewerId) {
    const result = await query(
      `SELECT s.*,
              EXISTS(SELECT 1 FROM story_views sv WHERE sv.story_id = s.id AND sv.viewer_id = $1) AS viewed
       FROM stories s
       WHERE s.user_id = $2 AND s.expires_at > NOW()
       ORDER BY s.created_at ASC`,
      [viewerId, userId]
    )
    return result.rows
  },

  /**
   * Mark a story as viewed
   */
  async markViewed(storyId, viewerId) {
    await query(
      `INSERT INTO story_views (story_id, viewer_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [storyId, viewerId]
    )
  },

  /**
   * Get viewers of a story
   */
  async getViewers(storyId) {
    const result = await query(
      `SELECT u.id, u.username, u.display_name, u.avatar_url, sv.viewed_at
       FROM story_views sv
       JOIN users u ON u.id = sv.viewer_id
       WHERE sv.story_id = $1
       ORDER BY sv.viewed_at DESC`,
      [storyId]
    )
    return result.rows
  },

  /**
   * Get view count for a story
   */
  async getViewCount(storyId) {
    const result = await query(
      'SELECT COUNT(*) AS view_count FROM story_views WHERE story_id = $1',
      [storyId]
    )
    return parseInt(result.rows[0].view_count) || 0
  },

  /**
   * Delete a story (only owner)
   */
  async delete(storyId, userId) {
    const result = await query(
      'DELETE FROM stories WHERE id = $1 AND user_id = $2 RETURNING id',
      [storyId, userId]
    )
    return result.rows.length > 0
  },

  /**
   * Clean up expired stories
   */
  async cleanExpired() {
    await query('DELETE FROM stories WHERE expires_at < NOW()')
  },
}

export default Story
