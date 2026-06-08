import { Router } from 'express';
import authenticate from '../middleware/auth.js';
import Community from '../models/Community.js';
import Channel from '../models/Channel.js';

const router = Router();
router.use(authenticate);

// ─── Communities ──────────────────────────────────────────

// GET /api/communities — all public
router.get('/', async (req, res, next) => {
  try {
    const communities = await Community.getAll();
    res.json({ communities });
  } catch (err) { next(err); }
});

// GET /api/communities/mine — user's communities
router.get('/mine', async (req, res, next) => {
  try {
    const communities = await Community.getByUser(req.user.id);
    res.json({ communities });
  } catch (err) { next(err); }
});

// POST /api/communities — create
router.post('/', async (req, res, next) => {
  try {
    const { name, description, bannerUrl, iconUrl } = req.body;
    if (!name || name.trim().length < 2) {
      return res.status(400).json({ error: 'El nombre debe tener al menos 2 caracteres' });
    }
    const community = await Community.create({
      name: name.trim(),
      description,
      bannerUrl,
      iconUrl,
      ownerId: req.user.id,
    });
    res.status(201).json({ community });
  } catch (err) { next(err); }
});

// GET /api/communities/:id — detail
router.get('/:id', async (req, res, next) => {
  try {
    const community = await Community.getById(req.params.id, req.user.id);
    if (!community) return res.status(404).json({ error: 'Comunidad no encontrada' });
    res.json({ community });
  } catch (err) { next(err); }
});

// DELETE /api/communities/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const deleted = await Community.delete(req.params.id, req.user.id);
    if (!deleted) return res.status(403).json({ error: 'Solo el creador puede eliminar la comunidad' });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// POST /api/communities/:id/join
router.post('/:id/join', async (req, res, next) => {
  try {
    const joined = await Community.join(req.params.id, req.user.id);
    res.json({ joined, message: joined ? 'Te uniste a la comunidad' : 'Ya eres miembro' });
  } catch (err) { next(err); }
});

// POST /api/communities/:id/leave
router.post('/:id/leave', async (req, res, next) => {
  try {
    const left = await Community.leave(req.params.id, req.user.id);
    if (!left) return res.status(400).json({ error: 'El creador no puede abandonar la comunidad' });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// POST /api/communities/join/:code — join by invite
router.post('/join/:code', async (req, res, next) => {
  try {
    const result = await Community.joinByInvite(req.params.code, req.user.id);
    if (!result) return res.status(404).json({ error: 'Código de invitación inválido' });
    res.json(result);
  } catch (err) { next(err); }
});

// GET /api/communities/:id/members
router.get('/:id/members', async (req, res, next) => {
  try {
    const members = await Community.getMembers(req.params.id);
    res.json({ members });
  } catch (err) { next(err); }
});

// PUT /api/communities/:id/members/:userId/role
router.put('/:id/members/:userId/role', async (req, res, next) => {
  try {
    const { role } = req.body;
    if (!['admin', 'moderator', 'member'].includes(role)) {
      return res.status(400).json({ error: 'Rol inválido' });
    }
    const updated = await Community.updateRole(req.params.id, req.params.userId, role, req.user.id);
    if (!updated) return res.status(403).json({ error: 'No tienes permisos para cambiar roles' });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ─── Channels ────────────────────────────────────────────

// GET /api/communities/:id/channels
router.get('/:id/channels', async (req, res, next) => {
  try {
    const channels = await Channel.getByCommunity(req.params.id);
    res.json({ channels });
  } catch (err) { next(err); }
});

// POST /api/communities/:id/channels
router.post('/:id/channels', async (req, res, next) => {
  try {
    const { name, description, type, isPrivate } = req.body;
    if (!name || name.trim().length < 2) {
      return res.status(400).json({ error: 'El nombre del canal debe tener al menos 2 caracteres' });
    }
    const channel = await Channel.create({
      communityId: req.params.id,
      name: name.trim().toLowerCase().replace(/\s+/g, '-'),
      description,
      type,
      isPrivate,
    });
    res.status(201).json({ channel });
  } catch (err) { next(err); }
});

// GET /api/communities/:id/channels/:channelId/messages
router.get('/:id/channels/:channelId/messages', async (req, res, next) => {
  try {
    const { limit, before } = req.query;
    const messages = await Channel.getMessages(
      req.params.channelId,
      parseInt(limit) || 50,
      before || null
    );
    res.json({ messages });
  } catch (err) { next(err); }
});

// POST /api/communities/:id/channels/:channelId/messages
router.post('/:id/channels/:channelId/messages', async (req, res, next) => {
  try {
    const { content, type } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'El mensaje no puede estar vacío' });
    }
    const message = await Channel.sendMessage({
      channelId: req.params.channelId,
      userId: req.user.id,
      content: content.trim(),
      type,
    });
    res.status(201).json({ message });
  } catch (err) { next(err); }
});

// DELETE /api/communities/:id/channels/:channelId
router.delete('/:id/channels/:channelId', async (req, res, next) => {
  try {
    const deleted = await Channel.delete(req.params.channelId);
    if (!deleted) return res.status(404).json({ error: 'Canal no encontrado' });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ─── Voice Rooms ─────────────────────────────────────────

// POST /api/communities/:id/voice-rooms — create voice room
router.post('/:id/voice-rooms', async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name || name.trim().length < 2) {
      return res.status(400).json({ error: 'El nombre debe tener al menos 2 caracteres' });
    }
    // Check ownership/admin
    const community = await Community.getById(req.params.id, req.user.id);
    if (!community) return res.status(404).json({ error: 'Comunidad no encontrada' });
    if (community.my_role !== 'owner' && community.my_role !== 'admin' && community.owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Solo el propietario o admin puede crear salas de voz' });
    }
    const { query } = await import('../db.js');
    const result = await query(
      `INSERT INTO voice_rooms (community_id, name) VALUES ($1, $2) RETURNING *`,
      [req.params.id, name.trim()]
    );
    res.status(201).json({ voiceRoom: result.rows[0] });
  } catch (err) { next(err); }
});

// PATCH /api/communities/:id/voice-rooms/:roomId — rename voice room
router.patch('/:id/voice-rooms/:roomId', async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name || name.trim().length < 2) {
      return res.status(400).json({ error: 'El nombre debe tener al menos 2 caracteres' });
    }
    const community = await Community.getById(req.params.id, req.user.id);
    if (!community) return res.status(404).json({ error: 'Comunidad no encontrada' });
    if (community.my_role !== 'owner' && community.my_role !== 'admin' && community.owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Solo el propietario o admin puede editar salas de voz' });
    }
    const { query } = await import('../db.js');
    const result = await query(
      `UPDATE voice_rooms SET name = $1 WHERE id = $2 AND community_id = $3 RETURNING *`,
      [name.trim(), req.params.roomId, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Sala no encontrada' });
    res.json({ voiceRoom: result.rows[0] });
  } catch (err) { next(err); }
});

// DELETE /api/communities/:id/voice-rooms/:roomId — delete voice room
router.delete('/:id/voice-rooms/:roomId', async (req, res, next) => {
  try {
    const community = await Community.getById(req.params.id, req.user.id);
    if (!community) return res.status(404).json({ error: 'Comunidad no encontrada' });
    if (community.my_role !== 'owner' && community.my_role !== 'admin' && community.owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Solo el propietario o admin puede eliminar salas de voz' });
    }
    const { query } = await import('../db.js');
    const result = await query(
      `DELETE FROM voice_rooms WHERE id = $1 AND community_id = $2 RETURNING id`,
      [req.params.roomId, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Sala no encontrada' });
    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;
