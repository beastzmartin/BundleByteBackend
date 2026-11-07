import express from 'express';
import {
  getAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
} from '../controllers/websiteController.js';
import { protect } from '../middleware/auth.js';
import { requireWebsitePermission } from '../middleware/websitePermissions.js';

const router = express.Router();

router.use(protect);
router.use(requireWebsitePermission('popup_manager'));

router.get('/', getAnnouncements);
router.post('/', createAnnouncement);
router.put('/:id', updateAnnouncement);
router.delete('/:id', deleteAnnouncement);

export default router;

