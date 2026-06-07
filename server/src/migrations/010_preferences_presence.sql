-- User preferences (chat background, theme, etc)
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  chat_bg VARCHAR(255) DEFAULT 'default',
  theme VARCHAR(20) DEFAULT 'dark',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Last seen / presence
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT FALSE;
