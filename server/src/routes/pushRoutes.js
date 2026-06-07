import { Router } from 'express'
import { query } from '../config/database.js'
import { VAPID_PUBLIC, webpush } from '../config/vapid.js'
import authenticate from '../middleware/auth.js'

const router = Router()

/**
 * GET /api/push/vapid-key — Devuelve la clave pública VAPID
 */
router.get('/vapid-key', (req, res) => {
  res.json({ publicKey: VAPID_PUBLIC })
})

/**
 * POST /api/push/subscribe — Guardar suscripción push del cliente
 */
router.post('/subscribe', authenticate, async (req, res) => {
  try {
    const { endpoint, keys } = req.body
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ error: 'Suscripción inválida' })
    }

    // Upsert — si el endpoint ya existe, actualizar
    await query(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (endpoint)
       DO UPDATE SET user_id = $1, p256dh = $3, auth = $4, created_at = NOW()`,
      [req.user.id, endpoint, keys.p256dh, keys.auth]
    )

    res.json({ success: true })
  } catch (err) {
    console.error('Push subscribe error:', err)
    res.status(500).json({ error: 'Error al guardar suscripción' })
  }
})

/**
 * DELETE /api/push/unsubscribe — Eliminar suscripción push
 */
router.delete('/unsubscribe', authenticate, async (req, res) => {
  try {
    const { endpoint } = req.body
    if (!endpoint) return res.status(400).json({ error: 'Endpoint requerido' })

    await query(
      'DELETE FROM push_subscriptions WHERE endpoint = $1 AND user_id = $2',
      [endpoint, req.user.id]
    )

    res.json({ success: true })
  } catch (err) {
    console.error('Push unsubscribe error:', err)
    res.status(500).json({ error: 'Error al eliminar suscripción' })
  }
})

/**
 * Enviar push notification a un usuario específico.
 * Se llama desde chatHandler cuando el usuario está offline.
 */
export async function sendPushToUser(userId, payload) {
  try {
    const result = await query(
      'SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1',
      [userId]
    )

    if (result.rows.length === 0) return

    const data = JSON.stringify(payload)

    // Enviar a todos los dispositivos del usuario
    const promises = result.rows.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          data
        )
      } catch (err) {
        // Si el endpoint expiró (410 Gone), eliminarlo
        if (err.statusCode === 410 || err.statusCode === 404) {
          await query('DELETE FROM push_subscriptions WHERE endpoint = $1', [sub.endpoint])
          console.log('🗑️ Removed expired push subscription')
        } else {
          console.error('Push send error:', err.statusCode || err.message)
        }
      }
    })

    await Promise.allSettled(promises)
  } catch (err) {
    console.error('sendPushToUser error:', err)
  }
}

export default router
