-- Add role column to conversation_members for group admin/member support
ALTER TABLE conversation_members ADD COLUMN IF NOT EXISTS role VARCHAR(10) DEFAULT 'member';

-- Add avatar_url to conversations for group photos
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS avatar_url TEXT;
