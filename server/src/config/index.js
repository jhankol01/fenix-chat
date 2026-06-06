import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Load .env from the server root
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '../../.env') });

/**
 * Application configuration
 * Centralizes all environment variables with defaults and validation.
 */
const config = {
  port: parseInt(process.env.PORT, 10) || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  frontendUrl: process.env.FRONTEND_URL || process.env.CORS_ORIGIN || 'http://localhost:5173',

  // Database (Phase 2)
  databaseUrl: process.env.DATABASE_URL || '',

  // Redis (Phase 3)
  redisUrl: process.env.REDIS_URL || '',

  // JWT (Phase 2)
  jwtSecret: process.env.JWT_SECRET || '',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || '',

  // Backblaze B2 Storage (Phase 4)
  b2KeyId: process.env.B2_KEY_ID || '',
  b2AppKey: process.env.B2_APP_KEY || '',
  b2BucketName: process.env.B2_BUCKET_NAME || '',

  // Resend (Email)
  resendApiKey: process.env.RESEND_API_KEY,
  resendFrom: process.env.RESEND_FROM || 'onboarding@resend.dev',
};

/**
 * Validates that critical environment variables are set.
 * Only enforced in production — development can run with defaults.
 */
export function validateConfig() {
  const requiredInProduction = [
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'DATABASE_URL',
  ];

  if (config.nodeEnv === 'production') {
    const missing = requiredInProduction.filter((key) => !process.env[key]);
    if (missing.length > 0) {
      throw new Error(
        `Missing required environment variables: ${missing.join(', ')}`
      );
    }
  }
}

export default config;
