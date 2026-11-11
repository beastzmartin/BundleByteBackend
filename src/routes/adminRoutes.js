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
import { requirePermission } from '../middleware/rbac.js';

const router = express.Router();

router.use(protect);

router.get('/analytics', requirePermission('dashboard.view'), getDashboardAnalytics);
router.get('/customers', requirePermission('customers.view'), getCustomers);
router.put('/customers/:id', requirePermission('customers.update'), updateCustomerStatus);

router.get('/inventory', requirePermission('license_inventory.view'), getInventory);
router.post('/inventory/keys', requirePermission('license_inventory.create'), addLicenseKeys);
router.delete('/inventory/keys/:id', requirePermission('license_inventory.delete'), deleteLicenseKey);

router.get('/refunds', requirePermission('refunds.view'), getRefunds);
router.put('/refunds/:id/review', requirePermission('refunds.update'), reviewRefund);

export default router;

