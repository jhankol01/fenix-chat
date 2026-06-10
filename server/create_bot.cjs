const { Pool } = require('pg')

const pool = new Pool({
  connectionString: 'postgresql://postgres:Poloche172906!@localhost:5432/fenix_chat'
})

async function main() {
  // Add is_bot column
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS is_bot BOOLEAN DEFAULT FALSE')
  console.log('✅ is_bot column added')

  // Create bot user
  const result = await pool.query(`
    INSERT INTO users (username, email, password_hash, display_name, is_verified, is_bot, status_text, status_emoji)
    VALUES ('fenix_ia', 'ia@fenixmessenger.com', '$2b$10$dummyHashForBotUserNeverUsedForLogin000000000000', 'Fenix IA', TRUE, TRUE, 'Asistente inteligente', '🤖')
    ON CONFLICT (username) DO UPDATE SET is_bot = TRUE, display_name = 'Fenix IA'
    RETURNING id, username
  `)
  console.log('✅ Bot user:', result.rows[0])

  // Verify
  const check = await pool.query("SELECT id, username, display_name, is_bot FROM users WHERE username = 'fenix_ia'")
  console.log('✅ Verified:', check.rows[0])

  await pool.end()
}

main().catch(e => { console.error('❌ Error:', e.message); process.exit(1) })
