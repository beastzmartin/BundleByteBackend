import express from 'express';
import {
  getLicenseInventory,
  addIndividualLicense,
  importLicenseKeysBulk,
  deleteLicenseKey,
  updateLicenseKey,
} from '../controllers/adminLicenseController.js';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/roles.js';

const router = express.Router();

router.use(protect);
router.use(authorize('admin', 'manager'));

router.get('/', getLicenseInventory);
router.post('/', addIndividualLicense);
router.post('/import', importLicenseKeysBulk);
router.put('/:id', updateLicenseKey);
router.delete('/:id', deleteLicenseKey);

export default router;

