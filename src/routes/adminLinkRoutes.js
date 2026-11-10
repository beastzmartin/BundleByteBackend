import express from 'express';
import {
  getLinkInventory,
  addIndividualLink,
  bulkImportLinks,
  updateLink,
  deleteLink,
} from '../controllers/adminLinkController.js';
import { protect, adminOnly } from '../middleware/auth.js';

const router = express.Router();

router.use(protect, adminOnly);

router.get('/', getLinkInventory);
router.post('/', addIndividualLink);
router.post('/bulk-import', bulkImportLinks);
router.put('/:id', updateLink);
router.delete('/:id', deleteLink);

export default router;
