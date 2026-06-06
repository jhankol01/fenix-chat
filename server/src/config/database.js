import pg from 'pg'
import config from './index.js'
import logger from '../utils/logger.js'

const { Pool } = pg

const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
})

pool.on('error', (err) => {
  logger.error('Unexpected PostgreSQL error:', err)
})

export const query = (text, params) => pool.query(text, params)
export const getClient = () => pool.connect()
export default pool
