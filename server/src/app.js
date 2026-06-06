import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

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

// ─── Rate Limiting ──────────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,                  // limit each IP to 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests, please try again later.',
  },
});
app.use(limiter);

// ─── API Routes ─────────────────────────────────────────────────────────────────
app.use('/api', routes);

// ─── Error Handling ─────────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ─── Start Server ───────────────────────────────────────────────────────────────
server.listen(config.port, () => {
  logger.info(`🔥 Fénix Chat server running on port ${config.port}`);
  logger.info(`📡 Environment: ${config.nodeEnv}`);
  logger.info(`🌐 CORS origin: ${config.corsOrigin}`);
  logger.info(`🔌 Socket.IO ready`);
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
