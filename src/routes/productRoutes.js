import express from 'express';
import {
  getProducts,
  getProductBySlug,
  getFeaturedProducts,
  getTrendingProducts,
  getSpecialOffers,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductByIdAdmin,
} from '../controllers/productController.js';
import { protect, optionalProtect } from '../middleware/auth.js';
import { authorize } from '../middleware/roles.js';

const router = express.Router();

router.get('/', getProducts);
router.get('/featured', getFeaturedProducts);
router.get('/trending', getTrendingProducts);
router.get('/special-offers', getSpecialOffers);
router.get('/admin/:id', protect, authorize('admin', 'manager'), getProductByIdAdmin);
router.get('/:slug', optionalProtect, getProductBySlug);

router.post('/', protect, authorize('admin', 'manager'), createProduct);
router.put('/:id', protect, authorize('admin', 'manager'), updateProduct);
router.delete('/:id', protect, authorize('admin'), deleteProduct);

export default router;

