import Category from '../models/Category.js';
import Product from '../models/Product.js';
import { logAudit } from '../middleware/audit.js';

export const getCategories = async (req, res, next) => {
  try {
    const categories = await Category.find({ isActive: true }).sort({ displayOrder: 1, name: 1 });

    // Aggregate product counts for each category
    const categoriesWithCount = await Promise.all(
      categories.map(async (cat) => {
        const count = await Product.countDocuments({ category: cat._id, status: 'active' });
        return {
          ...cat.toObject(),
          productCount: count,
        };
      })
    );

    res.status(200).json({
      success: true,
      count: categoriesWithCount.length,
      categories: categoriesWithCount,
    });
  } catch (error) {
    next(error);
  }
};

export const getCategoryBySlug = async (req, res, next) => {
  try {
    const category = await Category.findOne({ slug: req.params.slug, isActive: true });
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }
    const count = await Product.countDocuments({ category: category._id, status: 'active' });

    res.status(200).json({
      success: true,
      category: {
        ...category.toObject(),
        productCount: count,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const createCategory = async (req, res, next) => {
  try {
    const { name, slug, description, icon, image, badge, displayOrder } = req.body;
    const finalSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

    const category = await Category.create({
      name,
      slug: finalSlug,
      description,
      icon: icon || 'Layers',
      image,
      badge,
      displayOrder: displayOrder || 0,
    });

    await logAudit({
      actor: req.user._id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: 'CATEGORY_CREATED',
      entity: 'Category',
      entityId: category._id.toString(),
      details: { name: category.name },
      req,
    });

    res.status(201).json({ success: true, category });
  } catch (error) {
    next(error);
  }
};

export const updateCategory = async (req, res, next) => {
  try {
    const category = await Category.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    await logAudit({
      actor: req.user._id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: 'CATEGORY_UPDATED',
      entity: 'Category',
      entityId: category._id.toString(),
      details: req.body,
      req,
    });

    res.status(200).json({ success: true, category });
  } catch (error) {
    next(error);
  }
};

export const deleteCategory = async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    const linkedProducts = await Product.countDocuments({ category: category._id });
    if (linkedProducts > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete category: it is assigned to ${linkedProducts} products. Please reassign products first.`,
      });
    }

    await category.deleteOne();

    await logAudit({
      actor: req.user._id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: 'CATEGORY_DELETED',
      entity: 'Category',
      entityId: req.params.id,
      details: { name: category.name },
      req,
    });

    res.status(200).json({ success: true, message: 'Category deleted successfully' });
  } catch (error) {
    next(error);
  }
};

