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

export default router
