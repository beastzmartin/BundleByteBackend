import express from 'express';
import {
  getLinkInventory,
  addIndividualLink,
  bulkImportLinks,
  updateLink,
  deleteLink,
} from '../controllers/adminLinkController.js';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/roles.js';

const router = express.Router();

router.use(protect);
router.use(authorize('admin', 'manager', 'inventory_manager'));

router.get('/', getLinkInventory);
router.post('/', addIndividualLink);
router.post('/bulk-import', bulkImportLinks);
router.put('/:id', updateLink);
router.delete('/:id', deleteLink);

export default router;
