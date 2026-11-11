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
import { requirePermission } from '../middleware/rbac.js';

const router = express.Router();

router.get('/', getProducts);
router.get('/featured', getFeaturedProducts);
router.get('/trending', getTrendingProducts);
router.get('/special-offers', getSpecialOffers);
router.get('/admin/:id', protect, requirePermission('products.view'), getProductByIdAdmin);
router.get('/:slug', optionalProtect, getProductBySlug);

router.post('/', protect, requirePermission('products.create'), createProduct);
router.put('/:id', protect, requirePermission('products.update'), updateProduct);
router.delete('/:id', protect, requirePermission('products.delete'), deleteProduct);

export default router;

