import express from 'express';
import {
  getAdminPopups,
  getPopupById,
  createPopup,
  updatePopup,
  deletePopup,
  getPopupAnalytics,
} from '../controllers/websiteController.js';
import { protect } from '../middleware/auth.js';
import { requireWebsitePermission } from '../middleware/websitePermissions.js';

const router = express.Router();

router.use(protect);
router.use(requireWebsitePermission('popup_manager'));

router.get('/', getAdminPopups);
router.get('/:id', getPopupById);
router.post('/', createPopup);
router.put('/:id', updatePopup);
router.delete('/:id', deletePopup);
router.get('/:id/analytics', getPopupAnalytics);

export default router;

