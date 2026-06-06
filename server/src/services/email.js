import { Resend } from 'resend'
import config from '../config/index.js'
import logger from '../utils/logger.js'

let resend = null
if (config.resendApiKey) {
  resend = new Resend(config.resendApiKey)
}

export async function sendVerificationEmail(email, token) {
  const verifyUrl = `${config.frontendUrl}/verify/${token}`

  // Always log for dev
  logger.info(`\n========================================`)
  logger.info(`VERIFICATION EMAIL for ${email}`)
  logger.info(`Link: ${verifyUrl}`)
  logger.info(`========================================\n`)

  if (!resend) {
    logger.warn('Resend not configured — email logged to console only')
    return
  }

  try {
    const response = await resend.emails.send({
      from: config.resendFrom,
      to: email,
      subject: '🔥 Verifica tu cuenta de Fénix Chat',
      html: `
        <div style="font-family: 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; background: #0a0f1c; color: #e0e0e0; padding: 32px; border-radius: 16px;">
          <h1 style="color: #00F5FF; text-align: center; margin-bottom: 8px;">🔥 Fénix Chat</h1>
          <p style="text-align: center; color: #aaa; margin-bottom: 24px;">Bienvenido! Verifica tu cuenta para empezar.</p>
          <div style="text-align: center;">
            <a href="${verifyUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #00F5FF, #0066FF); color: #000; font-weight: bold; text-decoration: none; border-radius: 30px; font-size: 16px;">Verificar mi cuenta</a>
          </div>
          <p style="text-align: center; color: #666; font-size: 12px; margin-top: 24px;">Este link expira en 24 horas.</p>
        </div>
      `,
    })
    logger.info(`Resend API response: ${JSON.stringify(response)}`)
    if (response.error) {
      logger.error(`Resend error: ${JSON.stringify(response.error)}`)
    } else {
      logger.info(`Verification email sent to ${email} (id: ${response.data?.id})`)
    }
  } catch (err) {
    logger.error(`Failed to send verification email: ${err.message}`)
    logger.error(`Full error: ${JSON.stringify(err, null, 2)}`)
    // Don't throw — log to console as fallback
  }
}
export async function sendPasswordResetEmail(email, token) {
  const resetUrl = `${config.frontendUrl}/reset-password/${token}`

  logger.info(`\n========================================`)
  logger.info(`PASSWORD RESET EMAIL for ${email}`)
  logger.info(`Link: ${resetUrl}`)
  logger.info(`========================================\n`)

  if (!resend) {
    logger.warn('Resend not configured — email logged to console only')
    return
  }

  try {
    const response = await resend.emails.send({
      from: config.resendFrom,
      to: email,
      subject: '🔐 Recupera tu contraseña — Fénix Chat',
      html: `
        <div style="font-family: 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; background: #0a0f1c; color: #e0e0e0; padding: 32px; border-radius: 16px;">
          <h1 style="color: #00F5FF; text-align: center; margin-bottom: 8px;">🔐 Fénix Chat</h1>
          <p style="text-align: center; color: #aaa; margin-bottom: 24px;">Recibimos una solicitud para restablecer tu contraseña.</p>
          <div style="text-align: center;">
            <a href="${resetUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #FF2DAA, #8A00FF); color: #fff; font-weight: bold; text-decoration: none; border-radius: 30px; font-size: 16px;">Restablecer contraseña</a>
          </div>
          <p style="text-align: center; color: #666; font-size: 12px; margin-top: 24px;">Este link expira en 1 hora. Si no solicitaste esto, ignora este email.</p>
        </div>
      `,
    })
    logger.info(`Reset email sent to ${email} (id: ${response.data?.id})`)
  } catch (err) {
    logger.error(`Failed to send reset email: ${err.message}`)
  }
}

export default { sendVerificationEmail, sendPasswordResetEmail }
