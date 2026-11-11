import express from 'express';
import { getSettings, updateSettings } from '../controllers/settingsController.js';
import { protect } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';

const router = express.Router();

router.get('/', getSettings);
router.put('/', protect, requirePermission('system_settings.update'), updateSettings);

export default router;

