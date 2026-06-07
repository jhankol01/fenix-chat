-- Blocked users table
CREATE TABLE IF NOT EXISTS blocked_users (
  id SERIAL PRIMARY KEY,
  blocker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(blocker_id, blocked_id)
);
