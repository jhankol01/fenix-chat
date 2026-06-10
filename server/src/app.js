import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import Story from './models/Story.js';

import config, { validateConfig } from './config/index.js';
import logger from './utils/logger.js';
import routes from './routes/index.js';
import notFound from './middleware/notFound.js';
import errorHandler from './middleware/errorHandler.js';
import chatHandler from './sockets/chatHandler.js';

// ─── Validate Environment ───────────────────────────────────────────────────────
validateConfig();

// ─── Create Express App & HTTP Server ───────────────────────────────────────────
const app = express();
const server = createServer(app);

// ─── Socket.IO ──────────────────────────────────────────────────────────────────
const io = new SocketIOServer(server, {
  cors: {
    origin: config.corsOrigin,
    credentials: true,
  },
  maxHttpBufferSize: 10 * 1024 * 1024, // 10MB for audio messages
});

// Register socket event handlers
chatHandler(io);

// ─── Security Middleware ────────────────────────────────────────────────────────
app.use(helmet());

// ─── CORS ───────────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: config.corsOrigin,
    credentials: true,
  })
);

// ─── Request Logging ────────────────────────────────────────────────────────────
app.use(
  morgan(config.nodeEnv === 'production' ? 'combined' : 'dev')
);

// ─── Body Parsing ───────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Rate Limiting (custom in-memory) ───────────────────────────────────────
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 100;             // 100 requests per window per IP

app.use((req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  let entry = rateLimitMap.get(ip);

  if (!entry || now - entry.windowStart >= RATE_LIMIT_WINDOW_MS) {
    entry = { windowStart: now, count: 1 };
    rateLimitMap.set(ip, entry);
    return next();
  }

  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) {
    return res.status(429).json({
      success: false,
      message: 'Too many requests, please try again later.',
    });
  }
  next();
});

// Clean up stale rate-limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now - entry.windowStart >= RATE_LIMIT_WINDOW_MS) {
      rateLimitMap.delete(ip);
    }
  }
}, 5 * 60 * 1000);

// ─── Health Check ───────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: 'v9-privacy-friends', features: ['chat', 'voice_notes', 'calls', 'friend_requests', 'privacy', 'communities'] });
});

// ─── Debug: online users ────────────────────────────────────────────────────────
import { onlineUsers } from './sockets/chatHandler.js';
app.get('/api/debug/online', (req, res) => {
  const users = []
  for (const [userId, sockets] of onlineUsers.entries()) {
    users.push({ userId, socketCount: sockets.size, socketIds: Array.from(sockets) })
  }
  res.json({ onlineCount: users.length, users })
});
// ─── Force migration endpoint ─────────────────────────────────────────────────
app.get('/api/debug/migrate', async (req, res) => {
  const results = [];
  try {
    const { query: dbQuery } = await import('./config/database.js');
    
    // Friend requests
    await dbQuery(`CREATE TABLE IF NOT EXISTS friend_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status VARCHAR(20) DEFAULT 'pending',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(sender_id, receiver_id)
    )`);
    await dbQuery(`CREATE INDEX IF NOT EXISTS idx_friend_req_receiver ON friend_requests(receiver_id, status)`);
    await dbQuery(`CREATE INDEX IF NOT EXISTS idx_friend_req_sender ON friend_requests(sender_id, status)`);
    results.push('friend_requests table');

    // Privacy columns
    await dbQuery(`ALTER TABLE users ADD COLUMN IF NOT EXISTS allow_messages VARCHAR(20) DEFAULT 'everyone'`);
    await dbQuery(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_discoverable BOOLEAN DEFAULT true`);
    results.push('privacy columns');

    // Username change tracking
    await dbQuery(`ALTER TABLE users ADD COLUMN IF NOT EXISTS username_changed_at TIMESTAMPTZ`);
    results.push('username_changed_at column');

    // AI Bot columns
    await dbQuery(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_bot BOOLEAN DEFAULT FALSE`);
    await dbQuery(`ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_access BOOLEAN DEFAULT FALSE`);
    results.push('ai_access + is_bot columns');

    // Bot ideas table
    await dbQuery(`CREATE TABLE IF NOT EXISTS bot_ideas (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(200) NOT NULL,
      description TEXT,
      category VARCHAR(50) DEFAULT 'general',
      priority VARCHAR(20) DEFAULT 'media',
      status VARCHAR(20) DEFAULT 'pending',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);
    await dbQuery(`CREATE INDEX IF NOT EXISTS idx_bot_ideas_user ON bot_ideas(user_id)`);
    results.push('bot_ideas table');

    // Create fenix_ia bot user if not exists
    const botExists = await dbQuery("SELECT id FROM users WHERE username = 'fenix_ia'");
    if (botExists.rows.length === 0) {
      await dbQuery(`INSERT INTO users (username, email, password_hash, display_name, is_verified, is_bot, avatar_url)
        VALUES ('fenix_ia', 'bot@fenix.chat', 'BOT_NO_LOGIN', 'Fenix IA', true, true, '/fenix_ia_avatar.png')`);
      results.push('fenix_ia bot user created');
    } else {
      await dbQuery("UPDATE users SET is_bot = TRUE, is_verified = TRUE WHERE username = 'fenix_ia'");
      results.push('fenix_ia bot user updated');
    }

    // ── Wallets ──
    await dbQuery(`CREATE TABLE IF NOT EXISTS user_wallets (
      user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      balance INTEGER DEFAULT 0,
      total_earned INTEGER DEFAULT 0,
      streak_days INTEGER DEFAULT 0,
      last_story_date DATE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);
    results.push('user_wallets table');

    await dbQuery(`CREATE TABLE IF NOT EXISTS coin_transactions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      amount INTEGER NOT NULL,
      reason VARCHAR(100) NOT NULL,
      story_id UUID REFERENCES stories(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);
    await dbQuery(`CREATE INDEX IF NOT EXISTS idx_coin_transactions_user ON coin_transactions(user_id, created_at DESC)`);
    results.push('coin_transactions table');

    // Add caption and reaction_count to stories
    await dbQuery(`ALTER TABLE stories ADD COLUMN IF NOT EXISTS caption TEXT DEFAULT ''`);
    await dbQuery(`ALTER TABLE stories ADD COLUMN IF NOT EXISTS reaction_count INTEGER DEFAULT 0`);
    results.push('stories caption + reaction_count columns');

    res.json({ success: true, migrations: results });
  } catch (err) {
    res.status(500).json({ error: err.message, detail: err.detail || null, completed: results });
  }
});

// Store io instance on app for access in routes
app.set('io', io);

// ─── Grant AI access (debug) ─────────────────────────────────────────────────
app.get('/api/debug/grant-ai/:username', async (req, res) => {
  try {
    const { query: dbQuery } = await import('./config/database.js');
    const r = await dbQuery('UPDATE users SET ai_access = TRUE WHERE LOWER(username) = LOWER($1) RETURNING username, ai_access', [req.params.username]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ success: true, user: r.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Debug: view all ideas ────────────────────────────────────────────────────
app.get('/api/debug/ideas', async (req, res) => {
  try {
    const { query: dbQuery } = await import('./config/database.js');
    const result = await dbQuery(`SELECT bi.*, u.username, u.display_name
      FROM bot_ideas bi JOIN users u ON u.id = bi.user_id
      ORDER BY bi.created_at DESC`);
    res.json({ ideas: result.rows, total: result.rows.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── API Routes ─────────────────────────────────────────────────────────────────
app.use('/api', routes);

// ─── Fenix IA Bot ───────────────────────────────────────────────────────────────
import authenticate from './middleware/auth.js';
import pool from './config/database.js';

app.post('/api/bot/start', authenticate, async (req, res) => {
  try {
    const userId = req.user.id

    // Check if user has AI access
    const accessCheck = await pool.query('SELECT ai_access FROM users WHERE id = $1', [userId])
    if (!accessCheck.rows[0]?.ai_access) {
      return res.status(403).json({ error: '🔒 Acceso a Fenix IA restringido. Necesitas una clave de acceso beta.' })
    }

    const botResult = await pool.query("SELECT id FROM users WHERE username = 'fenix_ia' AND is_bot = TRUE LIMIT 1")
    if (!botResult.rows[0]) {
      return res.status(404).json({ error: 'Fenix IA no está disponible' })
    }
    const botUserId = botResult.rows[0].id

    // Get or create DM with bot
    const Conversation = (await import('./models/Conversation.js')).default
    const conversationId = await Conversation.getOrCreateDM(userId, botUserId)

    // Check if this is a new conversation (no messages yet)
    const msgCount = await pool.query('SELECT COUNT(*) FROM messages WHERE conversation_id = $1', [conversationId])
    if (parseInt(msgCount.rows[0].count) === 0) {
      // Send welcome message from bot
      const Message = (await import('./models/Message.js')).default
      const welcomeMsg = await Message.create({
        conversationId,
        senderId: botUserId,
        content: '¡Hola! 👋 Soy **Fenix IA**, tu asistente inteligente.\n\nPuedo ayudarte con:\n🧠 Preguntas generales\n💻 Programación y código\n📝 Escribir textos\n🔢 Matemáticas\n💡 Ideas y brainstorming\n\n¡Pregúntame lo que quieras! 🔥',
        type: 'text'
      })

      // Emit via socket if available
      const ioInstance = req.app.get('io')
      if (ioInstance) {
        ioInstance.to(conversationId).emit('new_message', welcomeMsg)
      }
    }

    res.json({ conversation: { id: conversationId } })
  } catch (err) {
    console.error('Bot start error:', err)
    res.status(500).json({ error: 'Error al iniciar chat con Fenix IA' })
  }
})

// Get saved ideas (authenticated user sees their own, or all with ?all=true for admin)
app.get('/api/bot/ideas', authenticate, async (req, res) => {
  try {
    const userId = req.user.id
    if (req.query.all === 'true') {
      // Admin/Antigravity view — all ideas
      const result = await pool.query(`
        SELECT bi.*, u.username, u.display_name 
        FROM bot_ideas bi JOIN users u ON u.id = bi.user_id 
        ORDER BY bi.created_at DESC
      `)
      return res.json({ ideas: result.rows })
    }
    const result = await pool.query(
      'SELECT * FROM bot_ideas WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    )
    res.json({ ideas: result.rows })
  } catch (err) {
    console.error('Ideas fetch error:', err)
    res.status(500).json({ error: 'Error al obtener ideas' })
  }
})

// Delete an idea
app.delete('/api/bot/ideas/:id', authenticate, async (req, res) => {
  try {
    await pool.query('DELETE FROM bot_ideas WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id])
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar idea' })
  }
})

// Grant/revoke AI access (admin only - jhankol)
app.post('/api/bot/access', authenticate, async (req, res) => {
  try {
    // Only jhankol can manage access
    const admin = await pool.query('SELECT username FROM users WHERE id = $1', [req.user.id])
    if (admin.rows[0]?.username !== 'jhankol') {
      return res.status(403).json({ error: 'Solo el administrador puede gestionar acceso' })
    }

    const { username, grant } = req.body
    if (!username) return res.status(400).json({ error: 'Username requerido' })

    const r = await pool.query(
      'UPDATE users SET ai_access = $1 WHERE username = $2 RETURNING username, ai_access',
      [grant !== false, username]
    )
    if (r.rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' })

    res.json({ success: true, user: r.rows[0], message: grant !== false ? '✅ Acceso AI otorgado' : '🔒 Acceso AI revocado' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// List users with AI access (admin only)
app.get('/api/bot/access', authenticate, async (req, res) => {
  try {
    const result = await pool.query("SELECT username, display_name, ai_access FROM users WHERE is_bot = FALSE ORDER BY ai_access DESC, username")
    res.json({ users: result.rows })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── Error Handling ─────────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ─── Start Server ───────────────────────────────────────────────────────────────
server.listen(config.port, async () => {
  logger.info(`🔥 Fénix Chat server running on port ${config.port}`);
  logger.info(`📡 Environment: ${config.nodeEnv}`);
  logger.info(`🌐 CORS origin: ${config.corsOrigin}`);
  logger.info(`🔌 Socket.IO ready`);

  // Run pending migrations
  try {
    const { query } = await import('./config/database.js');
    await query(`ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_type_check`);
    await query(`ALTER TABLE messages ADD CONSTRAINT messages_type_check CHECK (type IN ('text', 'image', 'system', 'audio'))`);
    logger.info('✅ Audio message type migration applied');

    // Password reset columns
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token VARCHAR(128)`);
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_expires TIMESTAMPTZ`);
    await query(`CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_token)`);
    logger.info('✅ Password reset migration applied');

    // Push notification subscriptions
    await query(`CREATE TABLE IF NOT EXISTS push_subscriptions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);
    await query(`CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_id)`);
    logger.info('✅ Push subscriptions migration applied');

    // ── Communities ──
    await query(`CREATE TABLE IF NOT EXISTS communities (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(100) NOT NULL,
      description TEXT DEFAULT '',
      banner_url TEXT,
      icon_url TEXT,
      owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      invite_code VARCHAR(20) UNIQUE DEFAULT substr(md5(random()::text), 1, 8),
      is_public BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);
    await query(`CREATE INDEX IF NOT EXISTS idx_communities_owner ON communities(owner_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_communities_invite ON communities(invite_code)`);

    await query(`CREATE TABLE IF NOT EXISTS community_members (
      community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'moderator', 'member')),
      joined_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (community_id, user_id)
    )`);

    await query(`CREATE TABLE IF NOT EXISTS community_channels (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
      name VARCHAR(50) NOT NULL,
      description TEXT DEFAULT '',
      type VARCHAR(20) DEFAULT 'text' CHECK (type IN ('text', 'announcements', 'vip')),
      position INTEGER DEFAULT 0,
      is_private BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);
    await query(`CREATE INDEX IF NOT EXISTS idx_channels_community ON community_channels(community_id, position)`);

    await query(`CREATE TABLE IF NOT EXISTS channel_messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      channel_id UUID NOT NULL REFERENCES community_channels(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      type VARCHAR(20) DEFAULT 'text' CHECK (type IN ('text', 'image', 'system')),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);
    await query(`CREATE INDEX IF NOT EXISTS idx_channel_msgs ON channel_messages(channel_id, created_at DESC)`);

    await query(`CREATE TABLE IF NOT EXISTS voice_rooms (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
      name VARCHAR(50) NOT NULL DEFAULT 'Sala General',
      max_participants INTEGER DEFAULT 20,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);

    await query(`CREATE TABLE IF NOT EXISTS voice_participants (
      room_id UUID NOT NULL REFERENCES voice_rooms(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      is_muted BOOLEAN DEFAULT false,
      joined_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (room_id, user_id)
    )`);
    logger.info('✅ Communities migration applied');
  } catch (err) {
    logger.warn('Migration note:', err.message);
  }

  // ── User Privacy Columns ──
  try {
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS allow_messages VARCHAR(20) DEFAULT 'everyone' CHECK (allow_messages IN ('everyone', 'contacts', 'nobody'))`);
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_discoverable BOOLEAN DEFAULT true`);
    logger.info('✅ User privacy migration applied');
  } catch (err) {
    logger.warn('Privacy migration note:', err.message);
  }

  // ── Friend Requests ──
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS friend_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(sender_id, receiver_id)
      )
    `);
    logger.info('✅ Friend requests table created');
  } catch (err) {
    logger.warn('Friend requests table note:', err.message);
  }
  try {
    await query(`CREATE INDEX IF NOT EXISTS idx_friend_req_receiver ON friend_requests(receiver_id, status)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_friend_req_sender ON friend_requests(sender_id, status)`);
  } catch (err) {
    logger.warn('Friend requests index note:', err.message);
  }

  // ── Fenix IA Bot User ──
  try {
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_bot BOOLEAN DEFAULT FALSE`);
    await query(`
      INSERT INTO users (username, email, password_hash, display_name, avatar_url, is_verified, is_bot, status_text, status_emoji)
      VALUES (
        'fenix_ia',
        'ia@fenixmessenger.com',
        '$2b$10$dummyHashForBotUserNeverUsedForLogin000000000000',
        'Fenix IA',
        NULL,
        TRUE,
        TRUE,
        'Asistente inteligente',
        '🤖'
      )
      ON CONFLICT (username) DO NOTHING
    `);
    logger.info('✅ Fenix IA bot user migration applied');
  } catch (err) {
    logger.warn('Fenix IA bot migration note:', err.message);
  }

  // ─── Story Cleanup Cron ─────────────────────────────────────────────────────
  // Run once on startup
  Story.cleanExpired()
    .then(() => logger.info('🧹 Expired stories cleaned on startup'))
    .catch((err) => logger.warn('Story cleanup error:', err.message));

  // Run every hour
  setInterval(() => {
    Story.cleanExpired()
      .then(() => logger.info('🧹 Expired stories cleaned (cron)'))
      .catch((err) => logger.warn('Story cleanup cron error:', err.message));
  }, 60 * 60 * 1000);
});

// ─── Graceful Shutdown ──────────────────────────────────────────────────────────
function gracefulShutdown(signal) {
  logger.info(`\n${signal} received. Shutting down gracefully...`);

  // Close all socket connections
  io.close(() => {
    logger.info('Socket.IO connections closed.');
  });

  server.close(() => {
    logger.info('HTTP server closed.');
    // Future: Close DB pool, Redis connection, etc.
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown — could not close connections in time.');
    process.exit(1);
  }, 10_000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export { io };
export default app;
