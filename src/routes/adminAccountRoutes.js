import express from 'express';
import {
  getAccountInventory,
  getAccountDetails,
  createSingleAccount,
  previewImport,
  commitImport,
  updateAccount,
  deleteAccount,
  bulkActionAccounts,
} from '../controllers/adminAccountController.js';
import { protect } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';

const router = express.Router();

router.use(protect);

router.route('/')
  .get(requirePermission('account_inventory.view'), getAccountInventory)
  .post(requirePermission('account_inventory.create'), createSingleAccount);

router.post('/preview', requirePermission('account_inventory.create'), previewImport);
router.post('/import', requirePermission('account_inventory.create'), commitImport);
router.post('/bulk-action', requirePermission('account_inventory.manage'), bulkActionAccounts);

router.route('/:id')
  .get(requirePermission('account_inventory.read'), getAccountDetails)
  .put(requirePermission('account_inventory.update'), updateAccount)
  .delete(requirePermission('account_inventory.delete'), deleteAccount);

export default router;

