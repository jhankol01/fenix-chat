// In-memory refresh token store
// In production, replace with Redis
const tokens = new Map()

export const tokenStore = {
  async set(key, value, ttlSeconds = 604800) {
    tokens.set(key, { value, expires: Date.now() + ttlSeconds * 1000 })
  },
  async get(key) {
    const entry = tokens.get(key)
    if (!entry) return null
    if (Date.now() > entry.expires) {
      tokens.delete(key)
      return null
    }
    return entry.value
  },
  async del(key) {
    tokens.delete(key)
  },
  async delByPrefix(prefix) {
    for (const key of tokens.keys()) {
      if (key.startsWith(prefix)) tokens.delete(key)
    }
  },
}

export default tokenStore
