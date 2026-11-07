import Product from '../models/Product.js';
import Category from '../models/Category.js';
import ProductVariant from '../models/ProductVariant.js';
import { logAudit } from '../middleware/audit.js';

export const getProducts = async (req, res, next) => {
  try {
    const {
      search,
      category,
      duration,
      isFeatured,
      isTrending,
      isPopular,
      isSpecialOffer,
      minPrice,
      maxPrice,
      sort,
      page = 1,
      limit = 12,
      status = 'active',
    } = req.query;

    const query = {};

    // Filter by status (admin can pass all)
    if (status !== 'all') {
      query.status = status || 'active';
    }

    // Search keyword
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } },
        { summary: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } },
      ];
    }

    // Category filter (slug or ID)
    if (category && category !== 'all') {
      if (category.match(/^[0-9a-fA-F]{24}$/)) {
        query.category = category;
      } else {
        const cat = await Category.findOne({ slug: category });
        if (cat) {
          query.category = cat._id;
        }
      }
    }

    // Duration filter
    if (duration && duration !== 'all') {
      query[`pricing.${duration}.enabled`] = true;
    }

    // Badges / Flags
    if (isFeatured === 'true') query.isFeatured = true;
    if (isTrending === 'true') query.isTrending = true;
    if (isPopular === 'true') query.isPopular = true;
    if (isSpecialOffer === 'true') query.isSpecialOffer = true;

    // Price range on default duration
    if (minPrice || maxPrice) {
      const priceCondition = {};
      if (minPrice) priceCondition.$gte = Number(minPrice);
      if (maxPrice) priceCondition.$lte = Number(maxPrice);
      query['pricing.annual.price'] = priceCondition;
    }

    // Sorting
    let sortOption = { createdAt: -1 };
    if (sort === 'price-low') {
      sortOption = { 'pricing.annual.price': 1 };
    } else if (sort === 'price-high') {
      sortOption = { 'pricing.annual.price': -1 };
    } else if (sort === 'rating') {
      sortOption = { averageRating: -1 };
    } else if (sort === 'popular') {
      sortOption = { salesCount: -1 };
    } else if (sort === 'title') {
      sortOption = { title: 1 };
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 12;
    const skip = (pageNum - 1) * limitNum;

    const total = await Product.countDocuments(query);
    const products = await Product.find(query)
      .select('-activationProcess -orderNote -activationSteps')
      .populate('category', 'name slug icon')
      .sort(sortOption)
      .skip(skip)
      .limit(limitNum);

    res.status(200).json({
      success: true,
      count: products.length,
      total,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      products,
    });
  } catch (error) {
    next(error);
  }
};

export const getProductBySlug = async (req, res, next) => {
  try {
    let product = await Product.findOne({ slug: req.params.slug }).populate('category', 'name slug icon');

    // If not found by exact slug, check if it's a timestamped variant (e.g. whatsapp-concierge-vip-tool-1793971843231)
    if (!product) {
      const baseSlug = req.params.slug.replace(/-\d+$/, '');
      if (baseSlug !== req.params.slug) {
        product = await Product.findOne({ slug: baseSlug }).populate('category', 'name slug icon');
      }
    }

    // Fallback: title regex match
    if (!product) {
      const titleCandidate = req.params.slug.replace(/-/g, ' ');
      product = await Product.findOne({ title: new RegExp(`^${titleCandidate}`, 'i') }).populate('category', 'name slug icon');
    }

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // Ensure status is active for customer accessibility
    if (product.status !== 'active') {
      product.status = 'active';
      await product.save();
    }

    const variants = await ProductVariant.find({ product: product._id });

    // Check if authenticated user has purchased this product
    let hasPurchased = false;
    let customerPurchasedOrder = null;
    if (req.user) {
      if (req.user.role === 'admin' || req.user.role === 'super_admin' || req.user.role === 'manager') {
        hasPurchased = true;
      } else {
        const Order = (await import('../models/Order.js')).default;
        customerPurchasedOrder = await Order.findOne({
          user: req.user._id,
          paymentStatus: 'paid',
          'items.product': product._id,
        }).select('orderNumber createdAt deliveryStatus items');
        hasPurchased = !!customerPurchasedOrder;
      }
    }

    const productObj = product.toObject();
    if (!hasPurchased) {
      // STRICT POST-PURCHASE PRIVACY: Never expose activation process or secret order notes before purchase!
      delete productObj.activationProcess;
      delete productObj.orderNote;
      delete productObj.activationSteps;
      productObj.hasPurchased = false;
    } else {
      productObj.hasPurchased = true;
      productObj.purchasedOrderRef = customerPurchasedOrder ? customerPurchasedOrder.orderNumber : null;
    }

    // Also get related products from same category
    const relatedProducts = await Product.find({
      category: product.category._id,
      _id: { $ne: product._id },
      status: 'active',
    })
      .select('-activationProcess -orderNote -activationSteps')
      .limit(4)
      .populate('category', 'name slug');

    res.status(200).json({
      success: true,
      product: productObj,
      variants,
      relatedProducts,
      hasPurchased,
    });
  } catch (error) {
    next(error);
  }
};

export const getFeaturedProducts = async (req, res, next) => {
  try {
    const products = await Product.find({ isFeatured: true, status: 'active' })
      .populate('category', 'name slug icon')
      .limit(8);
    res.status(200).json({ success: true, count: products.length, products });
  } catch (error) {
    next(error);
  }
};

export const getTrendingProducts = async (req, res, next) => {
  try {
    const products = await Product.find({ isTrending: true, status: 'active' })
      .populate('category', 'name slug icon')
      .limit(8);
    res.status(200).json({ success: true, count: products.length, products });
  } catch (error) {
    next(error);
  }
};

export const getSpecialOffers = async (req, res, next) => {
  try {
    const products = await Product.find({ isSpecialOffer: true, status: 'active' })
      .populate('category', 'name slug icon')
      .limit(8);
    res.status(200).json({ success: true, count: products.length, products });
  } catch (error) {
    next(error);
  }
};

export const createProduct = async (req, res, next) => {
  try {
    const { title, slug } = req.body;
    const finalSlug = slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

    const product = await Product.create({
      ...req.body,
      slug: finalSlug,
    });

    await logAudit({
      actor: req.user._id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: 'PRODUCT_CREATED',
      entity: 'Product',
      entityId: product._id.toString(),
      details: { title: product.title },
      req,
    });

    res.status(201).json({ success: true, product });
  } catch (error) {
    next(error);
  }
};

export const updateProduct = async (req, res, next) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    await logAudit({
      actor: req.user._id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: 'PRODUCT_UPDATED',
      entity: 'Product',
      entityId: product._id.toString(),
      details: { title: product.title },
      req,
    });

    res.status(200).json({ success: true, product });
  } catch (error) {
    next(error);
  }
};

export const deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // Instead of destructive drop, we can archive or soft-delete, or delete if no active orders
    await product.deleteOne();

    await logAudit({
      actor: req.user._id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: 'PRODUCT_DELETED',
      entity: 'Product',
      entityId: req.params.id,
      details: { title: product.title },
      req,
    });

    res.status(200).json({ success: true, message: 'Product deleted successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/products/admin/:id
 * Dedicated Admin/Manager endpoint to fetch complete product schema including proprietary activation process,
 * order notes, and full inventory metadata.
 */
export const getProductByIdAdmin = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id).populate('category', 'name slug icon');
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const variants = await ProductVariant.find({ product: product._id });

    res.status(200).json({
      success: true,
      product: {
        ...product.toObject(),
        hasPurchased: true,
      },
      variants,
    });
  } catch (error) {
    next(error);
  }
};


