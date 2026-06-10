const { Pool } = require('pg')
const bcrypt = require('bcrypt')

const pool = new Pool({
  connectionString: 'postgresql://postgres:Poloche172906!@localhost:5432/fenix_chat'
})

async function main() {
  const username = 'jhankol'
  const email = 'jhanamazon1729@gmail.com'
  const password = 'Poloche172906!'
  
  const hash = await bcrypt.hash(password, 10)
  
  const result = await pool.query(`
    INSERT INTO users (username, email, password_hash, display_name, is_verified)
    VALUES ($1, $2, $3, $4, TRUE)
    ON CONFLICT (username) DO UPDATE SET password_hash = $3, is_verified = TRUE
    RETURNING id, username, email
  `, [username, email, hash, username])
  
  console.log('✅ Usuario creado:')
  console.log('   Username:', result.rows[0].username)
  console.log('   Email:', result.rows[0].email)
  console.log('   Password: Poloche172906!')
  
  await pool.end()
}

main().catch(e => { console.error('Error:', e.message); process.exit(1) })
