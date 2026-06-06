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
    const sql = readFileSync(join(__dirname, '001_create_users.sql'), 'utf-8')
    await pool.query(sql)
    console.log('Migration 001_create_users completed')
    console.log('All migrations completed successfully!')
  } catch (err) {
    console.error('Migration failed:', err.message)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

runMigrations()
