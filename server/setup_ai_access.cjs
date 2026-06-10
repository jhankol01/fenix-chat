const { Pool } = require('pg')
const pool = new Pool({
  connectionString: 'postgresql://postgres:Poloche172906!@localhost:5432/fenix_chat'
})

async function main() {
  // Add ai_access column
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_access BOOLEAN DEFAULT FALSE')
  console.log('✅ Columna ai_access agregada (default: FALSE = nadie tiene acceso)')

  // Grant access to jhankol
  const r = await pool.query("UPDATE users SET ai_access = TRUE WHERE username = 'jhankol' RETURNING username")
  console.log('✅ Acceso AI otorgado a:', r.rows[0]?.username)

  // Verify
  const check = await pool.query("SELECT username, ai_access FROM users WHERE ai_access = TRUE")
  console.log('✅ Usuarios con acceso AI:', check.rows)

  await pool.end()
}

main().catch(e => { console.error(e); process.exit(1) })
