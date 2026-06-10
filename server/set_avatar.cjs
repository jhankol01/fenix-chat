const { Pool } = require('pg')
const pool = new Pool({
  connectionString: 'postgresql://postgres:Poloche172906!@localhost:5432/fenix_chat'
})

async function main() {
  const r = await pool.query(
    "UPDATE users SET avatar_url = '/fenix_ia_avatar.png' WHERE username = 'fenix_ia'"
  )
  console.log('✅ Avatar actualizado:', r.rowCount, 'row(s)')
  
  const check = await pool.query("SELECT username, display_name, avatar_url FROM users WHERE username = 'fenix_ia'")
  console.log('✅ Verificado:', check.rows[0])
  
  await pool.end()
}

main().catch(e => { console.error(e); process.exit(1) })
