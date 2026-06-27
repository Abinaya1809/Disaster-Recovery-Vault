import { Router } from 'express';
import { register, login, refresh, logout, forgotPassword, resetPassword, getNotifications, markNotificationsRead } from '../controllers/auth.controller';
import { authRateLimiter } from '../middlewares/rateLimiter';
import { authenticateToken } from '../middlewares/auth';

const router = Router();

router.post('/register', authRateLimiter, register);
router.post('/login', authRateLimiter, login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.post('/forgot-password', authRateLimiter, forgotPassword);
router.post('/reset-password', authRateLimiter, resetPassword);

// Notifications routes
router.get('/notifications', authenticateToken, getNotifications);
router.post('/notifications/read', authenticateToken, markNotificationsRead);

export default router;
