-- Add is_bot flag to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_bot BOOLEAN DEFAULT FALSE;

-- Create Fenix IA bot user (password is dummy, bot never logs in manually)
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
ON CONFLICT (username) DO NOTHING;
