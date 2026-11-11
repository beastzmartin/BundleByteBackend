import express from 'express';
import {
  getLicenseInventory,
  addIndividualLicense,
  importLicenseKeysBulk,
  deleteLicenseKey,
  updateLicenseKey,
} from '../controllers/adminLicenseController.js';
import { protect } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';

const router = express.Router();

router.use(protect);

router.get('/', requirePermission('license_inventory.view'), getLicenseInventory);
router.post('/', requirePermission('license_inventory.create'), addIndividualLicense);
router.post('/import', requirePermission('license_inventory.create'), importLicenseKeysBulk);
router.put('/:id', requirePermission('license_inventory.update'), updateLicenseKey);
router.delete('/:id', requirePermission('license_inventory.delete'), deleteLicenseKey);

export default router;

