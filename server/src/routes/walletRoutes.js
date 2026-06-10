import { Router } from 'express'
import Wallet from '../models/Wallet.js'
import authenticate from '../middleware/auth.js'

const router = Router()

// GET /api/wallet/balance — user's balance + streak info
router.get('/balance', authenticate, async (req, res) => {
  try {
    const wallet = await Wallet.getBalance(req.user.id)
    res.json({ wallet })
  } catch (err) {
    console.error('Error fetching wallet balance:', err.message)
    res.status(500).json({ error: 'Error obteniendo balance' })
  }
})

// GET /api/wallet/transactions — transaction history
router.get('/transactions', authenticate, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50
    const transactions = await Wallet.getTransactions(req.user.id, limit)
    res.json({ transactions })
  } catch (err) {
    console.error('Error fetching transactions:', err.message)
    res.status(500).json({ error: 'Error obteniendo transacciones' })
  }
})

// GET /api/wallet/leaderboard — top 10 creators by total_earned
router.get('/leaderboard', authenticate, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10
    const leaderboard = await Wallet.getLeaderboard(limit)
    res.json({ leaderboard })
  } catch (err) {
    console.error('Error fetching leaderboard:', err.message)
    res.status(500).json({ error: 'Error obteniendo leaderboard' })
  }
})

// GET /api/wallet/stats — user's creator stats
router.get('/stats', authenticate, async (req, res) => {
  try {
    const stats = await Wallet.getCreatorStats(req.user.id)
    res.json({ stats })
  } catch (err) {
    console.error('Error fetching creator stats:', err.message)
    res.status(500).json({ error: 'Error obteniendo estadísticas' })
  }
})

export default router
