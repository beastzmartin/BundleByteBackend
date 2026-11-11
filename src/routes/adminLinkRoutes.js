import express from 'express';
import {
  getLinkInventory,
  addIndividualLink,
  bulkImportLinks,
  updateLink,
  deleteLink,
} from '../controllers/adminLinkController.js';
import { protect } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';

const router = express.Router();

router.use(protect);

router.get('/', requirePermission('software_links.view'), getLinkInventory);
router.post('/', requirePermission('software_links.create'), addIndividualLink);
router.post('/bulk-import', requirePermission('software_links.create'), bulkImportLinks);
router.put('/:id', requirePermission('software_links.update'), updateLink);
router.delete('/:id', requirePermission('software_links.delete'), deleteLink);

export default router;
