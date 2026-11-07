import Order from '../models/Order.js';
import User from '../models/User.js';
import Subscription from '../models/Subscription.js';
import Product from '../models/Product.js';
import LicenseInventory from '../models/LicenseInventory.js';
import Payment from '../models/Payment.js';
import { logAudit } from '../middleware/audit.js';

export const getDashboardAnalytics = async (req, res, next) => {
  try {
    // 1. Overall stats
    const totalCustomers = await User.countDocuments({ role: 'customer' });
    const totalOrders = await Order.countDocuments();
    const paidOrders = await Order.find({ paymentStatus: 'paid' });

    const totalRevenue = paidOrders.reduce((sum, ord) => sum + (ord.totalAmount || 0), 0);

    const activeSubscriptions = await Subscription.countDocuments({ status: { $in: ['active', 'expiring_soon'] } });
    const expiredSubscriptions = await Subscription.countDocuments({ status: 'expired' });
    const totalProducts = await Product.countDocuments();

    // 2. Revenue by month / recent days aggregation
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 30);

    const salesAggregation = await Order.aggregate([
      {
        $match: {
          paymentStatus: 'paid',
          createdAt: { $gte: sevenDaysAgo },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          revenue: { $sum: '$totalAmount' },
          ordersCount: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // 3. Recent orders
    const recentOrders = await Order.find()
      .populate('user', 'name email avatar')
      .sort({ createdAt: -1 })
      .limit(6);

    // 4. Top selling products
    const topProducts = await Product.find({ status: 'active' })
      .populate('category', 'name slug')
      .sort({ salesCount: -1 })
      .limit(5);

    // 5. Category breakdown
    const categoryBreakdown = await Product.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 }, totalSales: { $sum: '$salesCount' } } },
      { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'categoryDetails' } },
      { $unwind: '$categoryDetails' },
      { $project: { name: '$categoryDetails.name', count: 1, totalSales: 1 } },
    ]);

    res.status(200).json({
      success: true,
      analytics: {
        totalRevenue: parseFloat(totalRevenue.toFixed(2)),
        totalOrders,
        totalCustomers,
        activeSubscriptions,
        expiredSubscriptions,
        totalProducts,
        salesTrends: salesAggregation,
        recentOrders,
        topProducts,
        categoryBreakdown,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getCustomers = async (req, res, next) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const skip = (pageNum - 1) * limitNum;

    const total = await User.countDocuments(query);
    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    // Get order counts and spend for each user
    const customersWithStats = await Promise.all(
      users.map(async (u) => {
        const orderCount = await Order.countDocuments({ user: u._id });
        const orders = await Order.find({ user: u._id, paymentStatus: 'paid' });
        const totalSpent = orders.reduce((sum, o) => sum + o.totalAmount, 0);
        return {
          ...u.toObject(),
          orderCount,
          totalSpent: parseFloat(totalSpent.toFixed(2)),
        };
      })
    );

    res.status(200).json({
      success: true,
      count: customersWithStats.length,
      total,
      customers: customersWithStats,
    });
  } catch (error) {
    next(error);
  }
};

export const updateCustomerStatus = async (req, res, next) => {
  try {
    const { isActive, role } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    if (isActive !== undefined) user.isActive = isActive;
    if (role && ['customer', 'manager', 'admin'].includes(role)) user.role = role;

    await user.save();

    await logAudit({
      actor: req.user._id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: 'CUSTOMER_UPDATED',
      entity: 'User',
      entityId: user._id.toString(),
      details: { isActive, role },
      req,
    });

    res.status(200).json({ success: true, message: 'Customer updated successfully', user });
  } catch (error) {
    next(error);
  }
};

// License Inventory Pool
export const getInventory = async (req, res, next) => {
  try {
    const { productId, isAllocated, page = 1, limit = 20 } = req.query;
    const query = {};

    if (productId && productId !== 'all') query.product = productId;
    if (isAllocated !== undefined && isAllocated !== 'all') {
      query.isAllocated = isAllocated === 'true';
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const skip = (pageNum - 1) * limitNum;

    const total = await LicenseInventory.countDocuments(query);
    const pool = await LicenseInventory.find(query)
      .populate('product', 'title slug logo')
      .populate('allocatedToUser', 'name email')
      .populate('allocatedToOrder', 'orderNumber')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const totalKeys = await LicenseInventory.countDocuments();
    const allocatedKeys = await LicenseInventory.countDocuments({ isAllocated: true });
    const availableKeys = totalKeys - allocatedKeys;

    res.status(200).json({
      success: true,
      stats: { totalKeys, allocatedKeys, availableKeys },
      count: pool.length,
      total,
      inventory: pool,
    });
  } catch (error) {
    next(error);
  }
};

export const addLicenseKeys = async (req, res, next) => {
  try {
    const { productId, durationType = 'any', keys = [], accountCredentials, accessLink, notes } = req.body;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const docsToInsert = [];

    // Bulk keys input (e.g. array of keys or multiline string)
    if (Array.isArray(keys) && keys.length > 0) {
      for (const k of keys) {
        if (k && k.trim()) {
          docsToInsert.push({
            product: product._id,
            durationType,
            licenseKey: k.trim(),
            accountCredentials: accountCredentials || {},
            accessLink: accessLink || '',
            notes: notes || '',
            isAllocated: false,
          });
        }
      }
    } else if (accountCredentials?.username || accessLink) {
      // Single digital account or access link
      docsToInsert.push({
        product: product._id,
        durationType,
        licenseKey: '',
        accountCredentials: accountCredentials || {},
        accessLink: accessLink || '',
        notes: notes || '',
        isAllocated: false,
      });
    }

    if (docsToInsert.length === 0) {
      return res.status(400).json({ success: false, message: 'Please provide at least one key, account or link' });
    }

    const inserted = await LicenseInventory.insertMany(docsToInsert);

    await logAudit({
      actor: req.user._id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: 'LICENSE_KEYS_UPLOADED',
      entity: 'LicenseInventory',
      entityId: product._id.toString(),
      details: { count: docsToInsert.length, productTitle: product.title },
      req,
    });

    res.status(201).json({
      success: true,
      message: `Successfully added ${inserted.length} digital inventory items`,
      count: inserted.length,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteLicenseKey = async (req, res, next) => {
  try {
    const record = await LicenseInventory.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ success: false, message: 'Inventory record not found' });
    }
    if (record.isAllocated) {
      return res.status(400).json({ success: false, message: 'Cannot delete a key that has already been allocated to a customer' });
    }

    await record.deleteOne();
    res.status(200).json({ success: true, message: 'Key removed from inventory' });
  } catch (error) {
    next(error);
  }
};

