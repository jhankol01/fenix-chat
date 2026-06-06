-- Add password reset fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token VARCHAR(128);
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_expires TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_token);
