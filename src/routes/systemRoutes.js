import express from 'express';
import {
  getSystemStats,
  flushCache,
  cleanStorage,
} from '../controllers/systemManagerController.js';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/roles.js';

const router = express.Router();

router.get('/system/stats', protect, authorize('admin'), getSystemStats);
router.post('/system/cache/flush', protect, authorize('admin'), flushCache);
router.post('/system/storage/clean', protect, authorize('admin'), cleanStorage);

export default router;
