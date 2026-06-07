import { Router } from 'express'
import config from '../config/index.js'

const router = Router()

const TENOR_BASE = 'https://tenor.googleapis.com/v2'

/**
 * GET /api/gifs/search?q=query
 * Proxies search requests to the Tenor v2 API, keeping the API key server-side.
 */
router.get('/search', async (req, res) => {
  const { q } = req.query
  if (!q || !q.trim()) {
    return res.status(400).json({ error: 'Query parameter "q" is required' })
  }

  try {
    const url = `${TENOR_BASE}/search?q=${encodeURIComponent(q)}&key=${config.tenorApiKey}&limit=20&media_filter=gif`
    const response = await fetch(url)
    const data = await response.json()
    res.json(data)
  } catch (err) {
    console.error('Tenor search proxy error:', err)
    res.status(502).json({ error: 'Failed to fetch GIFs from Tenor' })
  }
})

/**
 * GET /api/gifs/trending
 * Proxies trending/featured requests to the Tenor v2 API.
 */
router.get('/trending', async (req, res) => {
  try {
    const url = `${TENOR_BASE}/featured?key=${config.tenorApiKey}&limit=20&media_filter=gif`
    const response = await fetch(url)
    const data = await response.json()
    res.json(data)
  } catch (err) {
    console.error('Tenor trending proxy error:', err)
    res.status(502).json({ error: 'Failed to fetch trending GIFs from Tenor' })
  }
})

export default router
