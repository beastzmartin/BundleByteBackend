import express from 'express';
import {
  getBanners,
  createBanner,
  updateBanner,
  deleteBanner,
} from '../controllers/websiteController.js';
import { protect } from '../middleware/auth.js';
import { requireWebsitePermission } from '../middleware/websitePermissions.js';

const router = express.Router();

router.use(protect);
router.use(requireWebsitePermission('banner_manager'));

router.get('/', getBanners);
router.post('/', createBanner);
router.put('/:id', updateBanner);
router.delete('/:id', deleteBanner);

export default router;
