import express from 'express';
import {
  register,
  login,
  logout,
  getMe,
  updateProfile,
  updatePassword,
  updateEmail,
  forgotPassword,
  resetPassword,
  verifyEmail,
} from '../controllers/authController.js';
import {
  googleAuth,
  linkGoogle,
  unlinkGoogle,
  getGoogleConfig,
} from '../controllers/googleAuthController.js';
import {
  telegramAuth,
  linkTelegram,
  unlinkTelegram,
  getTelegramConfig,
} from '../controllers/telegramAuthController.js';
import {
  getInvitationByToken,
  acceptInvitation,
} from '../controllers/invitationController.js';
import { protect } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Public Authentication & Config Routes
router.get('/config', getGoogleConfig);
router.get('/google/config', getGoogleConfig);
router.get('/telegram/config', getTelegramConfig);
router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/google', authLimiter, googleAuth);
router.post('/telegram', authLimiter, telegramAuth);
router.post('/logout', logout);
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/reset-password/:token', authLimiter, resetPassword);
router.get('/verify-email/:token', verifyEmail);

// Public Team Invitation Endpoints
router.get('/team-invitation/verify/:token', getInvitationByToken);
router.post('/team-invitation/accept', authLimiter, acceptInvitation);

// Protected Account Routes
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.put('/updatepassword', protect, updatePassword);
router.put('/updateemail', protect, updateEmail);
router.post('/google/link', protect, linkGoogle);
router.delete('/google/unlink', protect, unlinkGoogle);
router.post('/telegram/link', protect, linkTelegram);
router.delete('/telegram/unlink', protect, unlinkTelegram);

export default router;

