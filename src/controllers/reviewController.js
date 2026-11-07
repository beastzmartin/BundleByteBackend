import Review from '../models/Review.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';

const recalculateProductRating = async (productId) => {
  const reviews = await Review.find({ product: productId, status: 'approved' });
  if (reviews.length === 0) {
    await Product.findByIdAndUpdate(productId, { averageRating: 5.0, totalReviews: 0 });
    return;
  }
  const sum = reviews.reduce((acc, curr) => acc + curr.rating, 0);
  const avg = parseFloat((sum / reviews.length).toFixed(1));
  await Product.findByIdAndUpdate(productId, { averageRating: avg, totalReviews: reviews.length });
};

export const getProductReviews = async (req, res, next) => {
  try {
    const reviews = await Review.find({ product: req.params.productId, status: 'approved' })
      .populate('user', 'name avatar')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: reviews.length,
      reviews,
    });
  } catch (error) {
    next(error);
  }
};

export const createReview = async (req, res, next) => {
  try {
    const { productId, rating, title, comment } = req.body;

    if (!productId || !rating || !title || !comment) {
      return res.status(400).json({ success: false, message: 'Please provide all review fields' });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // Check if user purchased this product
    const verifiedOrder = await Order.findOne({
      user: req.user._id,
      paymentStatus: 'paid',
      'items.product': product._id,
    });

    const review = await Review.create({
      product: product._id,
      user: req.user._id,
      userName: req.user.name,
      userAvatar: req.user.avatar || '',
      rating: Number(rating),
      title,
      comment,
      isVerifiedPurchase: !!verifiedOrder,
      status: 'approved', // auto approved
    });

    await recalculateProductRating(product._id);

    res.status(201).json({
      success: true,
      message: 'Review submitted successfully',
      review,
    });
  } catch (error) {
    next(error);
  }
};

export const getAllReviews = async (req, res, next) => {
  try {
    const reviews = await Review.find()
      .populate('product', 'title slug logo')
      .populate('user', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: reviews.length, reviews });
  } catch (error) {
    next(error);
  }
};

export const moderateReview = async (req, res, next) => {
  try {
    const { status } = req.body;
    const review = await Review.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!review) {
      return res.status(404).json({ success: false, message: 'Review not found' });
    }

    await recalculateProductRating(review.product);

    res.status(200).json({ success: true, review });
  } catch (error) {
    next(error);
  }
};

export const deleteReview = async (req, res, next) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ success: false, message: 'Review not found' });
    }
    const productId = review.product;
    await review.deleteOne();
    await recalculateProductRating(productId);

    res.status(200).json({ success: true, message: 'Review deleted successfully' });
  } catch (error) {
    next(error);
  }
};

