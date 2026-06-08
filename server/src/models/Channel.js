import { query } from '../config/database.js';

class Channel {
  static async getByCommunity(communityId) {
    const result = await query(
      `SELECT * FROM community_channels WHERE community_id = $1 ORDER BY position, created_at`,
      [communityId]
    );
    return result.rows;
  }

  static async create({ communityId, name, description, type, isPrivate }) {
    const posRes = await query(
      `SELECT COALESCE(MAX(position), -1) + 1 AS next_pos FROM community_channels WHERE community_id = $1`,
      [communityId]
    );
    const position = posRes.rows[0].next_pos;

    const result = await query(
      `INSERT INTO community_channels (community_id, name, description, type, position, is_private)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [communityId, name, description || '', type || 'text', position, isPrivate || false]
    );
    return result.rows[0];
  }

  static async getMessages(channelId, limit = 50, before = null) {
    let sql = `
      SELECT cm.*, u.username, u.display_name, u.avatar_url
      FROM channel_messages cm
      JOIN users u ON cm.user_id = u.id
      WHERE cm.channel_id = $1
    `;
    const params = [channelId];

    if (before) {
      sql += ` AND cm.created_at < $2`;
      params.push(before);
    }

    sql += ` ORDER BY cm.created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await query(sql, params);
    return result.rows.reverse();
  }

  static async sendMessage({ channelId, userId, content, type }) {
    const result = await query(
      `INSERT INTO channel_messages (channel_id, user_id, content, type)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [channelId, userId, content, type || 'text']
    );
    const msg = result.rows[0];

    // Attach user info
    const userRes = await query(
      `SELECT username, display_name, avatar_url FROM users WHERE id = $1`,
      [userId]
    );
    return { ...msg, ...userRes.rows[0] };
  }

  static async delete(channelId) {
    const result = await query(
      `DELETE FROM community_channels WHERE id = $1 RETURNING id`, [channelId]
    );
    return result.rows.length > 0;
  }
}

export default Channel;
