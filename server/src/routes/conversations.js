import { Router } from 'express'
import {
  getConversations,
  createConversation,
  getMessages,
  searchUsers,
  deleteConversation,
} from '../controllers/conversations.js'
import authenticate from '../middleware/auth.js'

const router = Router()

// All conversation routes require authentication
router.use(authenticate)

// GET  /api/conversations          - list user's conversations
router.get('/', getConversations)

// POST /api/conversations          - create a DM conversation
router.post('/', createConversation)

// GET  /api/conversations/:id/messages - get messages for a conversation
router.get('/:id/messages', getMessages)

// DELETE /api/conversations/:id  - delete a conversation
router.delete('/:id', deleteConversation)

export default router
