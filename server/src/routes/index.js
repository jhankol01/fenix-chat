import { Router } from 'express';
import { getHealth } from '../controllers/health.js';
import authRoutes from './auth.js';
import userRoutes from './users.js';
import conversationRoutes from './conversations.js';
import uploadRoutes from './upload.js';
import contactRoutes from './contactRoutes.js';
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

// Upload routes (avatars)
router.use('/upload', uploadRoutes);

// Contact routes
router.use('/contacts', contactRoutes);

// Preferences routes
import preferencesRoutes from './preferencesRoutes.js';
router.use('/preferences', preferencesRoutes);

// Admin routes
import { listUsers, getStats } from '../controllers/admin.js';
router.get('/admin/users', authenticate, listUsers);
router.get('/admin/stats', authenticate, getStats);

// Story routes
import storyRoutes from './storyRoutes.js';
router.use('/stories', storyRoutes);

export default router;
