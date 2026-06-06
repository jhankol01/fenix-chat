import { Router } from 'express';
import { getHealth } from '../controllers/health.js';
import authRoutes from './auth.js';
import userRoutes from './users.js';
import conversationRoutes from './conversations.js';
import { searchUsers } from '../controllers/conversations.js';
import authenticate from '../middleware/auth.js';

const router = Router();

// Health check
router.get('/health', getHealth);

// Auth routes
router.use('/auth', authRoutes);

// User routes
router.use('/users', userRoutes);

// User search (for starting new chats)
router.get('/users/search', authenticate, searchUsers);

// Conversation routes
router.use('/conversations', conversationRoutes);

export default router;
