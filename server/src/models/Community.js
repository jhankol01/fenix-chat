import { query } from '../config/database.js';

class Community {
  static async create({ name, description, bannerUrl, iconUrl, ownerId, isPublic = true }) {
    const result = await query(
      `INSERT INTO communities (name, description, banner_url, icon_url, owner_id, is_public)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name, description || '', bannerUrl || null, iconUrl || null, ownerId, isPublic]
    );
    const community = result.rows[0];

    await query(
      `INSERT INTO community_members (community_id, user_id, role) VALUES ($1, $2, 'owner')`,
      [community.id, ownerId]
    );

    await query(
      `INSERT INTO community_channels (community_id, name, description, type, position)
       VALUES ($1, 'chat-general', 'Conversación principal', 'text', 0)`,
      [community.id]
    );

    await query(
      `INSERT INTO voice_rooms (community_id, name) VALUES ($1, 'Sala General')`,
      [community.id]
    );

    return community;
  }

  static async getAll() {
    const result = await query(`
      SELECT c.*, u.username AS owner_username, u.avatar_url AS owner_avatar,
        (SELECT COUNT(*) FROM community_members WHERE community_id = c.id) AS member_count
      FROM communities c
      JOIN users u ON c.owner_id = u.id
      WHERE c.is_public = true
      ORDER BY c.created_at DESC
    `);
    return result.rows;
  }

  static async getByUser(userId) {
    const result = await query(`
      SELECT c.*, cm.role AS my_role, cm.joined_at,
        u.username AS owner_username,
        (SELECT COUNT(*) FROM community_members WHERE community_id = c.id) AS member_count
      FROM communities c
      JOIN community_members cm ON c.id = cm.community_id AND cm.user_id = $1
      JOIN users u ON c.owner_id = u.id
      ORDER BY cm.joined_at DESC
    `, [userId]);
    return result.rows;
  }

  static async getById(communityId, userId) {
    const communityRes = await query(`
      SELECT c.*, u.username AS owner_username, u.avatar_url AS owner_avatar,
        (SELECT COUNT(*) FROM community_members WHERE community_id = c.id) AS member_count
      FROM communities c
      JOIN users u ON c.owner_id = u.id
      WHERE c.id = $1
    `, [communityId]);

    if (communityRes.rows.length === 0) return null;
    const community = communityRes.rows[0];

    const memberRes = await query(
      `SELECT role FROM community_members WHERE community_id = $1 AND user_id = $2`,
      [communityId, userId]
    );
    community.my_role = memberRes.rows[0]?.role || null;
    community.is_member = memberRes.rows.length > 0;

    const channelsRes = await query(
      `SELECT * FROM community_channels WHERE community_id = $1 ORDER BY position, created_at`,
      [communityId]
    );
    community.channels = channelsRes.rows;

    const voiceRes = await query(`
      SELECT vr.*,
        (SELECT COUNT(*) FROM voice_participants WHERE room_id = vr.id) AS participant_count
      FROM voice_rooms vr
      WHERE vr.community_id = $1
      ORDER BY vr.created_at
    `, [communityId]);
    community.voice_rooms = voiceRes.rows;

    return community;
  }

  static async join(communityId, userId) {
    const existing = await query(
      `SELECT 1 FROM community_members WHERE community_id = $1 AND user_id = $2`,
      [communityId, userId]
    );
    if (existing.rows.length > 0) return false;
    await query(
      `INSERT INTO community_members (community_id, user_id) VALUES ($1, $2)`,
      [communityId, userId]
    );
    return true;
  }

  static async leave(communityId, userId) {
    const check = await query(
      `SELECT role FROM community_members WHERE community_id = $1 AND user_id = $2`,
      [communityId, userId]
    );
    if (check.rows[0]?.role === 'owner') return false;
    await query(
      `DELETE FROM community_members WHERE community_id = $1 AND user_id = $2`,
      [communityId, userId]
    );
    return true;
  }

  static async joinByInvite(inviteCode, userId) {
    const communityRes = await query(
      `SELECT id FROM communities WHERE invite_code = $1`, [inviteCode]
    );
    if (communityRes.rows.length === 0) return null;
    const communityId = communityRes.rows[0].id;
    const joined = await Community.join(communityId, userId);
    return { communityId, joined };
  }

  static async getMembers(communityId) {
    const result = await query(`
      SELECT u.id, u.username, u.display_name, u.avatar_url, u.status,
        cm.role, cm.joined_at
      FROM community_members cm
      JOIN users u ON cm.user_id = u.id
      WHERE cm.community_id = $1
      ORDER BY
        CASE cm.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 WHEN 'moderator' THEN 2 ELSE 3 END,
        cm.joined_at
    `, [communityId]);
    return result.rows;
  }

  static async updateRole(communityId, targetUserId, newRole, requesterId) {
    const reqRole = await query(
      `SELECT role FROM community_members WHERE community_id = $1 AND user_id = $2`,
      [communityId, requesterId]
    );
    if (!['owner', 'admin'].includes(reqRole.rows[0]?.role)) return false;
    if (newRole === 'owner') return false;
    await query(
      `UPDATE community_members SET role = $1 WHERE community_id = $2 AND user_id = $3`,
      [newRole, communityId, targetUserId]
    );
    return true;
  }

  static async delete(communityId, ownerId) {
    const result = await query(
      `DELETE FROM communities WHERE id = $1 AND owner_id = $2 RETURNING id`,
      [communityId, ownerId]
    );
    return result.rows.length > 0;
  }
}

export default Community;
