import express from 'express';
import { getUnifiedInventoryStats } from '../controllers/adminInventoryController.js';
import { protect, adminOnly } from '../middleware/auth.js';

const router = express.Router();

router.use(protect, adminOnly);

router.get('/unified-stats', getUnifiedInventoryStats);

export default router;

