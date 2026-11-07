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
import { protect, adminOnly } from '../middleware/auth.js';

const router = express.Router();

router.use(protect, adminOnly);

router.route('/')
  .get(getAccountInventory)
  .post(createSingleAccount);

router.post('/preview', previewImport);
router.post('/import', commitImport);
router.post('/bulk-action', bulkActionAccounts);

router.route('/:id')
  .get(getAccountDetails)
  .put(updateAccount)
  .delete(deleteAccount);

export default router;

