import { createRequire } from 'module';

// Read version from package.json
const require = createRequire(import.meta.url);
const pkg = require('../../package.json');

/**
 * GET /api/health
 * Returns current server health information.
 */
export function getHealth(_req, res) {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: pkg.version,
  });
}
