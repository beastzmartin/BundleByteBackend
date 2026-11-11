import express from 'express';
import {
  getCategories,
  getCategoryBySlug,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../controllers/categoryController.js';
import { protect } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';

const router = express.Router();

router.get('/', getCategories);
router.get('/:slug', getCategoryBySlug);
router.post('/', protect, requirePermission('products.create'), createCategory);
router.put('/:id', protect, requirePermission('products.update'), updateCategory);
router.delete('/:id', protect, requirePermission('products.delete'), deleteCategory);

export default router;

