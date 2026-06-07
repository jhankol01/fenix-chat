import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'
import dotenv from 'dotenv'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: join(__dirname, '../../.env') })

const { Pool } = pg
const isProduction = process.env.NODE_ENV === 'production'
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ...(isProduction && { ssl: { rejectUnauthorized: false } }),
})

async function runMigrations() {
  console.log('Running migrations...')
  try {
    const migrations = [
      '001_create_users.sql',
      '002_create_conversations.sql',
      '003_add_reset_token.sql',
      '004_add_audio_type.sql',
      '005_add_seen_at.sql',
      '006_create_contacts.sql',
      '007_add_video_type.sql',
      '008_add_reply_forward_delete.sql',
      '009_create_reactions.sql',
      '010_preferences_presence.sql',
      '011_groups.sql',
      '012_stories.sql',
      '013_blocked_users.sql',
    ]

    for (const file of migrations) {
      const sql = readFileSync(join(__dirname, file), 'utf-8')
      await pool.query(sql)
      console.log(`Migration ${file} completed`)
    }

    console.log('All migrations completed successfully!')
  } catch (err) {
    console.error('Migration failed:', err.message)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

runMigrations()
