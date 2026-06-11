import { Router } from 'express';
import { query } from '../config/database.js';
import Message from '../models/Message.js';
import Conversation from '../models/Conversation.js';
import logger from '../utils/logger.js';

const router = Router();

// Shared secret for webhook authentication
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'fenix-empire-2024-secure';

// Admin user (Jhankol) who receives notifications
const ADMIN_USERNAME = 'Jhankol';

/**
 * POST /api/webhook/notify
 * Receives notifications from external services (Empire Call, etc.)
 * and sends them as messages in Fenix Messenger.
 * 
 * Body: { secret, message, source?, type? }
 */
router.post('/notify', async (req, res) => {
  try {
    const { secret, message, source = 'Empire Call', type = 'alert' } = req.body;

    // Validate secret
    if (secret !== WEBHOOK_SECRET) {
      return res.status(403).json({ error: 'Invalid secret' });
    }

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Find admin user
    const adminRes = await query(
      `SELECT id FROM users WHERE username = $1`, [ADMIN_USERNAME]
    );
    if (adminRes.rows.length === 0) {
      return res.status(404).json({ error: 'Admin user not found' });
    }
    const adminId = adminRes.rows[0].id;

    // Find or create a bot user for Empire notifications
    let botRes = await query(
      `SELECT id FROM users WHERE username = 'Empire Call'`
    );
    
    let botId;
    if (botRes.rows.length === 0) {
      // Create the Empire Call bot user
      const createBot = await query(
        `INSERT INTO users (username, email, display_name, password_hash, is_bot, is_verified, avatar_url)
         VALUES ('Empire Call', 'empire@system.local', 'Empire Call', 'no-login', true, true, null)
         RETURNING id`
      );
      botId = createBot.rows[0].id;
      logger.info('Created Empire Call bot user');
    } else {
      botId = botRes.rows[0].id;
    }

    // Get or create DM conversation between Empire bot and admin
    const conversationId = await Conversation.getOrCreateDM(botId, adminId);

    // Format the notification message
    const icons = {
      alert: '🔔',
      recharge: '💰',
      support: '🆘',
      info: 'ℹ️',
      warning: '⚠️',
    };
    const icon = icons[type] || '🔔';
    const formattedMessage = `${icon} **${source}**\n\n${message}`;

    // Save message in database
    const msg = await Message.create({
      conversationId,
      senderId: botId,
      content: formattedMessage,
      type: 'text',
    });

    // Update conversation last message
    await query(
      `UPDATE conversations SET last_message_at = NOW(), last_message_content = $1, last_message_sender = $2 WHERE id = $3`,
      [formattedMessage.slice(0, 100), 'Empire Call', conversationId]
    ).catch(() => {});

    // Try to send via Socket.IO if admin is online
    const io = req.app.get('io');
    if (io) {
      const { onlineUsers } = await import('../sockets/chatHandler.js');
      const adminSockets = onlineUsers.get(adminId);
      if (adminSockets && adminSockets.size > 0) {
        for (const sid of adminSockets) {
          io.to(sid).emit('new_message', msg);
          io.to(sid).emit('notification', {
            type: 'empire_alert',
            title: source,
            body: message.slice(0, 100),
            conversationId,
          });
        }
      }
    }

    logger.info(`Webhook notification sent to admin: ${message.slice(0, 50)}`);
    res.json({ success: true, messageId: msg.id });

  } catch (err) {
    logger.error('Webhook error:', err.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

export default router;
