import express from 'express';
import { getUnifiedInventoryStats } from '../controllers/adminInventoryController.js';
import { protect } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';

const router = express.Router();

router.use(protect);

router.get('/unified-stats', requirePermission('license_inventory.view'), getUnifiedInventoryStats);

export default router;

