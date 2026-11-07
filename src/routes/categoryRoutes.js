import express from 'express';
import {
  getCategories,
  getCategoryBySlug,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../controllers/categoryController.js';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/roles.js';

const router = express.Router();

router.get('/', getCategories);
router.get('/:slug', getCategoryBySlug);
router.post('/', protect, authorize('admin', 'manager'), createCategory);
router.put('/:id', protect, authorize('admin', 'manager'), updateCategory);
router.delete('/:id', protect, authorize('admin'), deleteCategory);

export default router;

