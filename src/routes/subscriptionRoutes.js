import express from 'express';
import {
  getMySubscriptions,
  renewSubscription,
  getAllSubscriptions,
  updateSubscriptionStatus,
} from '../controllers/subscriptionController.js';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/roles.js';

const router = express.Router();

router.use(protect);

router.get('/my', getMySubscriptions);
router.post('/renew', renewSubscription);
router.get('/all', authorize('admin', 'manager'), getAllSubscriptions);
router.put('/:id', authorize('admin'), updateSubscriptionStatus);

export default router;

