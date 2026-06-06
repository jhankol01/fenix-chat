import config from '../config/index.js';
import logger from '../utils/logger.js';

/**
 * Global error handling middleware.
 * Catches all errors passed via next(err) and returns a structured JSON response.
 * Stack traces are only included in development mode.
 */
// eslint-disable-next-line no-unused-vars
export default function errorHandler(err, req, res, _next) {
  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Internal Server Error';

  logger.error(`${statusCode} - ${message} - ${req.originalUrl} - ${req.method}`);

  res.status(statusCode).json({
    success: false,
    message,
    ...(config.nodeEnv === 'development' && { stack: err.stack }),
  });
}
