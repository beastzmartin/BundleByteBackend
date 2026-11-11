import express from 'express';
import {
  getMySubscriptions,
  renewSubscription,
  getAllSubscriptions,
  updateSubscriptionStatus,
} from '../controllers/subscriptionController.js';
import { protect } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';

const router = express.Router();

router.use(protect);

router.get('/my', getMySubscriptions);
router.post('/renew', renewSubscription);
router.get('/all', requirePermission('subscriptions.view'), getAllSubscriptions);
router.put('/:id', requirePermission('subscriptions.update'), updateSubscriptionStatus);

export default router;

