import { Router } from 'express'
import multer from 'multer'
import sharp from 'sharp'
import authenticate from '../middleware/auth.js'
import { uploadToB2 } from '../services/storage.js'
import { query } from '../config/database.js'
import logger from '../utils/logger.js'

const router = Router()

// Multer: accept images up to 5MB, store in memory
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true)
    } else {
      cb(new Error('Solo se permiten imágenes'), false)
    }
  },
})

// POST /api/upload/avatar
router.post('/avatar', authenticate, upload.single('avatar'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se proporcionó una imagen' })
    }

    // Resize to 256x256 and convert to WebP
    const resized = await sharp(req.file.buffer)
      .resize(256, 256, { fit: 'cover', position: 'center' })
      .webp({ quality: 80 })
      .toBuffer()

    // Upload to B2
    const avatarUrl = await uploadToB2(resized, 'avatars', 'image/webp')
    logger.info(`Avatar uploaded for ${req.user.id}: ${avatarUrl}`)

    // Update user's avatar_url in database
    await query(
      'UPDATE users SET avatar_url = $1, updated_at = NOW() WHERE id = $2',
      [avatarUrl, req.user.id]
    )

    res.json({ avatarUrl })
  } catch (err) {
    logger.error('Avatar upload error:', err.message)
    next(err)
  }
})

// Multer for chat media: images up to 10MB, videos up to 50MB
const mediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/') || file.mimetype.startsWith('audio/')) {
      cb(null, true)
    } else {
      cb(new Error('Solo se permiten imágenes, videos y audio'), false)
    }
  },
})

// POST /api/upload/media — Upload chat image or video
router.post('/media', authenticate, mediaUpload.single('media'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se proporcionó un archivo' })
    }

    const isImage = req.file.mimetype.startsWith('image/')
    const isVideo = req.file.mimetype.startsWith('video/')
    const isAudio = req.file.mimetype.startsWith('audio/')
    const folder = isImage ? 'chat-images' : isVideo ? 'chat-videos' : 'chat-audio'

    let buffer = req.file.buffer
    let mimeType = req.file.mimetype

    // Compress images (not videos)
    if (isImage) {
      const sharp = (await import('sharp')).default
      buffer = await sharp(req.file.buffer)
        .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer()
      mimeType = 'image/jpeg'
    }

    const url = await uploadToB2(buffer, folder, mimeType)
    logger.info(`Media uploaded by ${req.user.id}: ${url}`)

    res.json({
      url,
      type: isImage ? 'image' : isVideo ? 'video' : 'audio',
      originalName: req.file.originalname,
    })
  } catch (err) {
    logger.error('Media upload error:', err.message)
    next(err)
  }
})

// POST /api/upload/community-banner — Upload community banner/cover
router.post('/community-banner', authenticate, upload.single('banner'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se proporcionó una imagen' })
    }
    const { communityId } = req.body
    if (!communityId) {
      return res.status(400).json({ error: 'communityId requerido' })
    }

    // Verify user is owner or admin
    const memberRes = await query(
      `SELECT role FROM community_members WHERE community_id = $1 AND user_id = $2`,
      [communityId, req.user.id]
    )
    if (!memberRes.rows[0] || !['owner', 'admin'].includes(memberRes.rows[0].role)) {
      return res.status(403).json({ error: 'No tienes permisos' })
    }

    // Resize to 1200x400 banner format
    const resized = await sharp(req.file.buffer)
      .resize(1200, 400, { fit: 'cover', position: 'center' })
      .webp({ quality: 85 })
      .toBuffer()

    const bannerUrl = await uploadToB2(resized, 'community-banners', 'image/webp')
    logger.info(`Community banner uploaded for ${communityId}: ${bannerUrl}`)

    await query(
      'UPDATE communities SET banner_url = $1 WHERE id = $2',
      [bannerUrl, communityId]
    )

    res.json({ bannerUrl })
  } catch (err) {
    logger.error('Banner upload error:', err.message)
    next(err)
  }
})

export default router
