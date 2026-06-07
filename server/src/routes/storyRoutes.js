import { Router } from 'express'
import Story from '../models/Story.js'
import { authenticateToken } from '../middleware/auth.js'

const router = Router()

// GET /api/stories — Get all active stories
router.get('/', authenticateToken, async (req, res) => {
  try {
    const stories = await Story.getAll(req.user.id)
    
    // Group by user
    const grouped = {}
    for (const story of stories) {
      if (!grouped[story.user_id]) {
        grouped[story.user_id] = {
          userId: story.user_id,
          username: story.username,
          displayName: story.display_name,
          avatarUrl: story.avatar_url,
          stories: [],
          hasUnviewed: false,
        }
      }
      grouped[story.user_id].stories.push(story)
      if (!story.viewed) grouped[story.user_id].hasUnviewed = true
    }

    // Put current user first, then unviewed, then viewed
    const userStories = Object.values(grouped).sort((a, b) => {
      if (a.userId === req.user.id) return -1
      if (b.userId === req.user.id) return 1
      if (a.hasUnviewed && !b.hasUnviewed) return -1
      if (!a.hasUnviewed && b.hasUnviewed) return 1
      return 0
    })

    res.json({ stories: userStories })
  } catch (err) {
    console.error('Error loading stories:', err.message)
    res.status(500).json({ error: 'Error cargando historias' })
  }
})

// POST /api/stories — Create a new story
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { content, type, backgroundColor, fontSize } = req.body
    if (!content) return res.status(400).json({ error: 'El contenido es requerido' })

    const story = await Story.create({
      userId: req.user.id,
      content,
      type: type || 'text',
      backgroundColor: backgroundColor || '#7C3AED',
      fontSize: fontSize || 'medium',
    })

    res.json({ story })
  } catch (err) {
    console.error('Error creating story:', err.message)
    res.status(500).json({ error: 'Error creando historia' })
  }
})

// POST /api/stories/:id/view — Mark story as viewed
router.post('/:id/view', authenticateToken, async (req, res) => {
  try {
    await Story.markViewed(req.params.id, req.user.id)
    res.json({ success: true })
  } catch (err) {
    console.error('Error marking story viewed:', err.message)
    res.status(500).json({ error: 'Error' })
  }
})

// DELETE /api/stories/:id — Delete own story
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const deleted = await Story.delete(req.params.id, req.user.id)
    if (!deleted) return res.status(404).json({ error: 'Historia no encontrada' })
    res.json({ success: true })
  } catch (err) {
    console.error('Error deleting story:', err.message)
    res.status(500).json({ error: 'Error eliminando historia' })
  }
})

export default router
