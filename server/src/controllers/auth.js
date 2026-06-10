import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { body, validationResult } from 'express-validator'
import User from '../models/User.js'
import config from '../config/index.js'
import tokenStore from '../config/tokenStore.js'
import { sendVerificationEmail, sendPasswordResetEmail } from '../services/email.js'
import logger from '../utils/logger.js'

const SALT_ROUNDS = 12
const ACCESS_TOKEN_EXPIRY = '1h'
const REFRESH_TOKEN_EXPIRY_SECONDS = 7 * 24 * 60 * 60 // 7 days
const REMEMBER_ME_EXPIRY_SECONDS = 30 * 24 * 60 * 60 // 30 days

// Generate JWT tokens
function generateAccessToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, username: user.username },
    config.jwtSecret,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  )
}

function generateRefreshToken() {
  return crypto.randomBytes(40).toString('hex')
}

// Validation rules
export const registerValidation = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 30 }).withMessage('Username debe tener 3-30 caracteres')
    .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username solo puede contener letras, números y _'),
  body('email')
    .isEmail().withMessage('Email inválido')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 6 }).withMessage('Password debe tener al menos 6 caracteres'),
]

export const loginValidation = [
  body('email').trim().notEmpty().withMessage('Email o username requerido'),
  body('password').notEmpty().withMessage('Password requerido'),
]

// POST /api/auth/register
export async function register(req, res, next) {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }

    const { username, email, password } = req.body

    // Check if username exists
    const existingUsername = await User.findByUsername(username)
    if (existingUsername) {
      if (!existingUsername.is_verified) {
        // Unverified account — delete and allow re-registration
        await User.deleteById(existingUsername.id)
      } else {
        return res.status(409).json({ error: 'Este username ya está en uso' })
      }
    }

    // Check if email exists
    const existingEmail = await User.findByEmail(email)
    if (existingEmail) {
      if (!existingEmail.is_verified) {
        // Unverified account — delete and allow re-registration
        await User.deleteById(existingEmail.id)
      } else {
        return res.status(409).json({ error: 'Este email ya está registrado' })
      }
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS)

    // Generate verification token
    const verifyToken = crypto.randomBytes(32).toString('hex')
    const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    // Create user
    const user = await User.create({
      username,
      email,
      passwordHash,
      verifyToken,
      verifyExpires,
    })

    // Send verification email
    await sendVerificationEmail(email, verifyToken)

    logger.info(`User registered: ${username} (${email})`)

    res.status(201).json({
      message: 'Cuenta creada. Revisa tu email para verificar tu cuenta.',
      user: { id: user.id, username: user.username, email: user.email },
    })
  } catch (err) {
    next(err)
  }
}

// POST /api/auth/login
export async function login(req, res, next) {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }

    const { email, password, rememberMe } = req.body

    // Find user by email or username
    let user = await User.findByEmail(email)
    if (!user) {
      user = await User.findByUsername(email)
    }
    if (!user) {
      return res.status(401).json({ error: 'Credenciales inválidas' })
    }

    // Check password
    const validPassword = await bcrypt.compare(password, user.password_hash)
    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciales inválidas' })
    }

    // Check verification
    if (!user.is_verified) {
      return res.status(403).json({
        error: 'Verifica tu email primero. Revisa tu bandeja de entrada.',
        code: 'EMAIL_NOT_VERIFIED',
        email: user.email,
      })
    }

    // Generate tokens
    const accessToken = generateAccessToken(user)
    const refreshToken = generateRefreshToken()

    // Store refresh token — 30 days if rememberMe, 7 days otherwise
    const expiry = rememberMe ? REMEMBER_ME_EXPIRY_SECONDS : REFRESH_TOKEN_EXPIRY_SECONDS
    await tokenStore.set(`refresh:${refreshToken}`, user.id, expiry)

    logger.info(`User logged in: ${user.username}`)

    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.display_name,
        avatarUrl: user.avatar_url,
        statusText: user.status_text,
        statusEmoji: user.status_emoji,
      },
    })
  } catch (err) {
    next(err)
  }
}

// POST /api/auth/refresh
export async function refresh(req, res, next) {
  try {
    const { refreshToken } = req.body
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token requerido' })
    }

    // Look up the refresh token
    const userId = await tokenStore.get(`refresh:${refreshToken}`)
    if (!userId) {
      return res.status(401).json({ error: 'Refresh token inválido o expirado' })
    }

    // Delete old token
    await tokenStore.del(`refresh:${refreshToken}`)

    // Get user
    const user = await User.findById(userId)
    if (!user) {
      return res.status(401).json({ error: 'Usuario no encontrado' })
    }

    // Generate new tokens
    const newAccessToken = generateAccessToken(user)
    const newRefreshToken = generateRefreshToken()

    // Store new refresh token
    await tokenStore.set(`refresh:${newRefreshToken}`, user.id, REFRESH_TOKEN_EXPIRY_SECONDS)

    res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    })
  } catch (err) {
    next(err)
  }
}

// POST /api/auth/logout
export async function logout(req, res, next) {
  try {
    const { refreshToken } = req.body
    if (refreshToken) {
      await tokenStore.del(`refresh:${refreshToken}`)
    }
    res.json({ message: 'Sesión cerrada' })
  } catch (err) {
    next(err)
  }
}

// GET /api/auth/verify/:token
export async function verifyEmail(req, res, next) {
  try {
    const { token } = req.params
    const user = await User.verifyEmail(token)

    if (!user) {
      return res.status(400).json({ error: 'Token de verificación inválido o expirado' })
    }

    logger.info(`Email verified: ${user.username} (${user.email})`)

    res.json({
      message: '¡Email verificado! Ya puedes iniciar sesión.',
      user: { id: user.id, username: user.username, email: user.email },
    })
  } catch (err) {
    next(err)
  }
}

// POST /api/auth/resend-verification
export async function resendVerification(req, res, next) {
  try {
    const { email } = req.body
    if (!email) {
      return res.status(400).json({ error: 'Email requerido' })
    }

    const user = await User.findByEmail(email)
    if (!user || user.is_verified) {
      // Don't reveal if user exists
      return res.json({ message: 'Si el email existe, se envió un nuevo link de verificación.' })
    }

    // Generate new token
    const verifyToken = crypto.randomBytes(32).toString('hex')
    const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000)
    await User.updateVerifyToken(user.id, verifyToken, verifyExpires)

    await sendVerificationEmail(email, verifyToken)

    logger.info(`Verification email resent to ${email}`)

    res.json({ message: 'Link de verificación reenviado. Revisa tu email.' })
  } catch (err) {
    next(err)
  }
}

// POST /api/auth/forgot-password
export async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body
    if (!email) {
      return res.status(400).json({ error: 'Email requerido' })
    }

    const user = await User.findByEmail(email)
    if (!user || !user.is_verified) {
      // Don't reveal if user exists
      return res.json({ message: 'Si el email existe, recibirás un link para restablecer tu contraseña.' })
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex')
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000) // 1 hour
    await User.setResetToken(user.id, resetToken, resetExpires)

    // Send reset email
    await sendPasswordResetEmail(email, resetToken)

    logger.info(`Password reset requested for ${email}`)

    res.json({ message: 'Si el email existe, recibirás un link para restablecer tu contraseña.' })
  } catch (err) {
    next(err)
  }
}

// POST /api/auth/reset-password
export async function resetPassword(req, res, next) {
  try {
    const { token, password } = req.body
    if (!token || !password) {
      return res.status(400).json({ error: 'Token y nueva contraseña requeridos' })
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' })
    }

    const user = await User.findByResetToken(token)
    if (!user) {
      return res.status(400).json({ error: 'Token inválido o expirado. Solicita un nuevo link.' })
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS)
    await User.updatePassword(user.id, passwordHash)

    logger.info(`Password reset successful for ${user.username} (${user.email})`)

    res.json({ message: '¡Contraseña actualizada! Ya puedes iniciar sesión.' })
  } catch (err) {
    next(err)
  }
}
