import LicenseInventory from '../models/LicenseInventory.js';
import Product from '../models/Product.js';
import { importProductKeys } from '../services/bulkImportService.js';
import { logAudit } from '../middleware/audit.js';

/**
 * GET /api/admin/licenses
 * List license keys with 5-status filter, product search, pagination, and low-stock telemetry
 */
export const getLicenseInventory = async (req, res, next) => {
  try {
    const {
      status, // 'Available', 'Reserved', 'Sold', 'Disabled', 'Expired', or 'all'
      productId,
      search,
      page = 1,
      limit = 20,
    } = req.query;

    const query = {};

    if (status && status !== 'all') {
      query.status = status;
    }

    if (productId && productId !== 'all') {
      query.product = productId;
    }

    if (search && search.trim()) {
      query.$or = [
        { licenseKey: { $regex: search.trim(), $options: 'i' } },
        { batchTag: { $regex: search.trim(), $options: 'i' } },
        { 'accountCredentials.username': { $regex: search.trim(), $options: 'i' } },
      ];
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const [licenses, total] = await Promise.all([
      LicenseInventory.find(query)
        .populate('product', 'title slug logo deliveryMethod')
        .populate('allocatedToUser', 'name email')
        .populate('allocatedToOrder', 'orderNumber')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      LicenseInventory.countDocuments(query),
    ]);

    // Status counts summary
    const [availableCount, soldCount, reservedCount, disabledCount, expiredCount] =
      await Promise.all([
        LicenseInventory.countDocuments({ status: 'Available' }),
        LicenseInventory.countDocuments({ status: 'Sold' }),
        LicenseInventory.countDocuments({ status: 'Reserved' }),
        LicenseInventory.countDocuments({ status: 'Disabled' }),
        LicenseInventory.countDocuments({ status: 'Expired' }),
      ]);

    // Find products with low available stock (<= 5 keys)
    const lowStockAggregation = await LicenseInventory.aggregate([
      { $match: { status: 'Available' } },
      { $group: { _id: '$product', count: { $sum: 1 } } },
      { $match: { count: { $lte: 5 } } },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'productDetails',
        },
      },
      { $unwind: '$productDetails' },
      {
        $project: {
          productId: '$_id',
          productTitle: '$productDetails.title',
          availableKeys: '$count',
        },
      },
    ]);

    res.status(200).json({
      success: true,
      licenses,
      stats: {
        total: availableCount + soldCount + reservedCount + disabledCount + expiredCount,
        available: availableCount,
        sold: soldCount,
        reserved: reservedCount,
        disabled: disabledCount,
        expired: expiredCount,
        lowStockProducts: lowStockAggregation,
      },
      pagination: {
        total,
        page: pageNum,
        pages: Math.ceil(total / limitNum),
        limit: limitNum,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/licenses
 * Add individual license key or account credential
 */
export const addIndividualLicense = async (req, res, next) => {
  try {
    const {
      productId,
      durationType = 'annual',
      licenseKey,
      accountCredentials = {},
      accessLink = '',
      status = 'Available',
      expiryDate = null,
      batchTag = '',
      adminNotes = '',
    } = req.body;

    if (!productId || !licenseKey) {
      return res.status(400).json({
        success: false,
        message: 'Product ID and license key are required',
      });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // Check duplicate
    const existing = await LicenseInventory.findOne({ product: productId, licenseKey: licenseKey.trim() });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'This license key already exists for this product',
      });
    }

    const license = await LicenseInventory.create({
      product: productId,
      durationType,
      licenseKey: licenseKey.trim(),
      accountCredentials: {
        username: accountCredentials.username || '',
        password: accountCredentials.password || '',
        recoveryInfo: accountCredentials.recoveryInfo || '',
      },
      accessLink: accessLink || product.defaultAccessLink || '',
      status,
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      batchTag: batchTag || 'MANUAL-ENTRY',
      adminNotes: adminNotes || `Created by ${req.user.name || req.user.email}`,
    });

    await logAudit({
      actor: req.user._id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: 'LICENSE_KEY_ADDED',
      entity: 'LicenseInventory',
      entityId: license._id.toString(),
      details: { productId, keyMasked: licenseKey.slice(0, 4) + '****' },
      req,
    });

    res.status(201).json({
      success: true,
      message: 'License key added successfully',
      license,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/licenses/import
 * Bulk key import from raw CSV or TXT content
 */
export const importLicenseKeysBulk = async (req, res, next) => {
  try {
    const {
      productId,
      durationType = 'annual',
      fileContent,
      batchTag = '',
    } = req.body;

    if (!productId) {
      return res.status(400).json({ success: false, message: 'Product ID is required' });
    }

    if (!fileContent || !fileContent.trim()) {
      return res.status(400).json({
        success: false,
        message: 'File content (CSV or TXT formatted keys) is required',
      });
    }

    const importResult = await importProductKeys({
      productId,
      durationType,
      fileContent,
      adminUser: req.user,
      batchTag,
    });

    await logAudit({
      actor: req.user._id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: 'LICENSE_KEYS_BULK_IMPORTED',
      entity: 'LicenseInventory',
      entityId: productId,
      details: importResult,
      req,
    });

    res.status(200).json({
      success: true,
      message: `Successfully imported ${importResult.importedCount} keys (${importResult.skippedCount} duplicates skipped).`,
      result: importResult,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/admin/licenses/:id
 * Delete or disable a license key
 */
export const deleteLicenseKey = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { permanent = false } = req.query;

    const license = await LicenseInventory.findById(id);
    if (!license) {
      return res.status(404).json({ success: false, message: 'License key not found' });
    }

    if (license.status === 'Sold') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete an already sold/allocated key. You may mark it Disabled instead.',
      });
    }

    if (permanent === 'true') {
      await LicenseInventory.findByIdAndDelete(id);
      await logAudit({
        actor: req.user._id,
        actorEmail: req.user.email,
        actorRole: req.user.role,
        action: 'LICENSE_KEY_DELETED',
        entity: 'LicenseInventory',
        entityId: id,
        req,
      });

      return res.status(200).json({
        success: true,
        message: 'License key permanently removed from inventory',
      });
    } else {
      // Soft disable
      license.status = 'Disabled';
      license.adminNotes = `Disabled by ${req.user.email} on ${new Date().toISOString()}`;
      await license.save();

      return res.status(200).json({
        success: true,
        message: 'License key status marked as Disabled',
        license,
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/admin/licenses/:id
 * Update license key details, status or expiry date
 */
export const updateLicenseKey = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, licenseKey, accountCredentials, accessLink, expiryDate, adminNotes } = req.body;

    const license = await LicenseInventory.findById(id);
    if (!license) {
      return res.status(404).json({ success: false, message: 'License key not found' });
    }

    if (status) license.status = status;
    if (licenseKey) license.licenseKey = licenseKey.trim();
    if (accountCredentials) license.accountCredentials = accountCredentials;
    if (accessLink) license.accessLink = accessLink;
    if (expiryDate !== undefined) license.expiryDate = expiryDate ? new Date(expiryDate) : null;
    if (adminNotes) license.adminNotes = adminNotes;

    await license.save();

    res.status(200).json({
      success: true,
      message: 'License key updated successfully',
      license,
    });
  } catch (error) {
    next(error);
  }
};

