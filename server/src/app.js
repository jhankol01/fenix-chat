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
  res.json({ status: 'ok', version: 'v8-avatar-calls-fix', features: ['chat', 'voice_notes', 'calls', 'delete_conv', 'delete_msg', 'avatars'] });
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

// ─── API Routes ─────────────────────────────────────────────────────────────────
app.use('/api', routes);

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
  } catch (err) {
    logger.warn('Migration note:', err.message);
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
