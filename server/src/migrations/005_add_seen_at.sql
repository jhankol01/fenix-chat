-- Add seen_at column for read receipts (flame indicator)
ALTER TABLE messages ADD COLUMN IF NOT EXISTS seen_at TIMESTAMPTZ DEFAULT NULL;
