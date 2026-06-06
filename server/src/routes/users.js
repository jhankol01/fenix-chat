import { Router } from 'express'
import { getMe, updateMe } from '../controllers/users.js'
import authenticate from '../middleware/auth.js'

const router = Router()

router.get('/me', authenticate, getMe)
router.patch('/me', authenticate, updateMe)

export default router
