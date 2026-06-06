import { Router } from 'express'
import {
  register, login, refresh, logout, verifyEmail, resendVerification,
  forgotPassword, resetPassword,
  registerValidation, loginValidation,
} from '../controllers/auth.js'
import authenticate from '../middleware/auth.js'

const router = Router()

router.post('/register', registerValidation, register)
router.post('/login', loginValidation, login)
router.post('/refresh', refresh)
router.post('/logout', authenticate, logout)
router.get('/verify/:token', verifyEmail)
router.post('/resend-verification', resendVerification)
router.post('/forgot-password', forgotPassword)
router.post('/reset-password', resetPassword)

export default router
