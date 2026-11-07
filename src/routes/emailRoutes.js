import express from 'express';
import {
  getMyEmailPreferences,
  updateMyEmailPreferences,
  getMyEmailHistory,
} from '../controllers/adminEmailController.js';
import { protect } from '../middleware/auth.js';
import DeliveryNotification from '../models/DeliveryNotification.js';
import DigitalDelivery from '../models/DigitalDelivery.js';

const router = express.Router();

router.get('/preferences', protect, getMyEmailPreferences);
router.put('/preferences', protect, updateMyEmailPreferences);
router.get('/my-history', protect, getMyEmailHistory);

/**
 * GET /api/email/secure-delivery/:token
 * Validates short-lived token and returns delivered digital goods
 */
router.get('/secure-delivery/:token', protect, async (req, res) => {
  try {
    const { token } = req.params;
    const notification = await DeliveryNotification.findOne({
      secureAccessToken: token,
      tokenExpiresAt: { $gt: new Date() },
    }).populate('order');

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Invalid or expired secure delivery access token. Please login to your customer dashboard to access your vault.',
      });
    }

    // Verify requesting user is the rightful recipient
    if (notification.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access to this delivery token.',
      });
    }

    notification.accessCount += 1;
    if (!notification.firstAccessedAt) notification.firstAccessedAt = new Date();
    notification.lastAccessedAt = new Date();
    await notification.save();

    // Fetch the digital deliveries for this order
    const deliveries = await DigitalDelivery.find({ order: notification.order._id });

    return res.status(200).json({
      success: true,
      order: notification.order,
      deliveries,
      message: 'Secure delivery token verified',
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
