const { Pool } = require('pg')
const pool = new Pool({
  connectionString: 'postgresql://postgres:Poloche172906!@localhost:5432/fenix_chat'
})

async function main() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bot_ideas (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id),
      title VARCHAR(200) NOT NULL,
      description TEXT NOT NULL,
      category VARCHAR(50) DEFAULT 'general',
      status VARCHAR(20) DEFAULT 'pending',
      priority VARCHAR(10) DEFAULT 'medium',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  console.log('✅ Tabla bot_ideas creada')

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_bot_ideas_user ON bot_ideas(user_id)`)
  console.log('✅ Índice creado')

  await pool.end()
}

main().catch(e => { console.error(e); process.exit(1) })
