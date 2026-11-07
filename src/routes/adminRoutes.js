import express from 'express';
import {
  getDashboardAnalytics,
  getCustomers,
  updateCustomerStatus,
  getInventory,
  addLicenseKeys,
  deleteLicenseKey,
} from '../controllers/adminController.js';
import { getRefunds, reviewRefund } from '../controllers/refundController.js';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/roles.js';

const router = express.Router();

router.use(protect, authorize('admin', 'manager'));

router.get('/analytics', getDashboardAnalytics);
router.get('/customers', getCustomers);
router.put('/customers/:id', authorize('admin'), updateCustomerStatus);

router.get('/inventory', getInventory);
router.post('/inventory/keys', addLicenseKeys);
router.delete('/inventory/keys/:id', authorize('admin'), deleteLicenseKey);

router.get('/refunds', getRefunds);
router.put('/refunds/:id/review', authorize('admin'), reviewRefund);

export default router;

