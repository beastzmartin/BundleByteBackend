import Wishlist from '../models/Wishlist.js';

export const getWishlist = async (req, res, next) => {
  try {
    let wishlist = await Wishlist.findOne({ user: req.user._id }).populate({
      path: 'products',
      populate: { path: 'category', select: 'name slug' },
    });

    if (!wishlist) {
      wishlist = await Wishlist.create({ user: req.user._id, products: [] });
    }

    res.status(200).json({
      success: true,
      count: wishlist.products.length,
      wishlist: wishlist.products,
    });
  } catch (error) {
    next(error);
  }
};

export const addToWishlist = async (req, res, next) => {
  try {
    const { productId } = req.body;
    let wishlist = await Wishlist.findOne({ user: req.user._id });

    if (!wishlist) {
      wishlist = await Wishlist.create({ user: req.user._id, products: [productId] });
    } else {
      if (!wishlist.products.includes(productId)) {
        wishlist.products.push(productId);
        await wishlist.save();
      }
    }

    res.status(200).json({
      success: true,
      message: 'Product added to wishlist',
      count: wishlist.products.length,
    });
  } catch (error) {
    next(error);
  }
};

export const removeFromWishlist = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const wishlist = await Wishlist.findOne({ user: req.user._id });

    if (wishlist) {
      wishlist.products = wishlist.products.filter((id) => id.toString() !== productId);
      await wishlist.save();
    }

    res.status(200).json({
      success: true,
      message: 'Product removed from wishlist',
      count: wishlist ? wishlist.products.length : 0,
    });
  } catch (error) {
    next(error);
  }
};

