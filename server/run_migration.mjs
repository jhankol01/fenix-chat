import pg from 'pg'
const { Pool } = pg

const pool = new Pool({ connectionString: 'postgresql://postgres:Poloche172906!@localhost:5432/fenix_chat' })

async function run() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_id)`)
  console.log('✅ push_subscriptions table created')
  await pool.end()
}

run().catch(e => { console.error(e); process.exit(1) })
