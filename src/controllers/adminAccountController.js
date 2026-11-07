import AccountInventory from '../models/AccountInventory.js';
import Product from '../models/Product.js';
import AccountImportBatch from '../models/AccountImportBatch.js';
import {
  previewAccountImport,
  commitAccountImport,
} from '../services/accountInventoryService.js';
import { encryptCredential } from '../utils/credentialEncryption.js';

/**
 * GET /api/admin/accounts
 * List accounts with status filters, product filtering, search, pagination, and stock stats
 */
export const getAccountInventory = async (req, res, next) => {
  try {
    const {
      status, // Available, Reserved, Sold, Disabled, Expired, or all
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
        { username: { $regex: search.trim(), $options: 'i' } },
        { batchTag: { $regex: search.trim(), $options: 'i' } },
        { accountType: { $regex: search.trim(), $options: 'i' } },
        { plan: { $regex: search.trim(), $options: 'i' } },
      ];
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const skip = (pageNum - 1) * limitNum;

    const [accounts, total] = await Promise.all([
      AccountInventory.find(query)
        .populate('product', 'title slug logo deliveryMethod category')
        .populate('allocatedToUser', 'name email')
        .populate('allocatedToOrder', 'orderNumber')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      AccountInventory.countDocuments(query),
    ]);

    // Aggregate statistics
    const [availableCount, soldCount, reservedCount, disabledCount, expiredCount] =
      await Promise.all([
        AccountInventory.countDocuments({ status: 'Available' }),
        AccountInventory.countDocuments({ status: 'Sold' }),
        AccountInventory.countDocuments({ status: 'Reserved' }),
        AccountInventory.countDocuments({ status: 'Disabled' }),
        AccountInventory.countDocuments({ status: 'Expired' }),
      ]);

    // Format safe response with masked passwords
    const safeAccounts = accounts.map((acc) => {
      const obj = acc.toObject();
      obj.hasPassword = !!obj.encryptedPassword;
      delete obj.encryptedPassword; // Keep encrypted cipher out of general table listings
      return obj;
    });

    res.status(200).json({
      success: true,
      data: safeAccounts,
      meta: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 1,
        stats: {
          total: availableCount + soldCount + reservedCount + disabledCount + expiredCount,
          available: availableCount,
          sold: soldCount,
          reserved: reservedCount,
          disabled: disabledCount,
          expired: expiredCount,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/admin/accounts/:id
 * Retrieve single account details with decrypted password (authorized admin inspection)
 */
export const getAccountDetails = async (req, res, next) => {
  try {
    const account = await AccountInventory.findById(req.params.id)
      .populate('product', 'title slug logo deliveryMethod')
      .populate('allocatedToUser', 'name email')
      .populate('allocatedToOrder', 'orderNumber totalAmount paymentStatus');

    if (!account) {
      return res.status(404).json({ success: false, message: 'Account not found' });
    }

    const decryptedPassword = account.getDecryptedPassword();
    const result = account.toObject();
    result.decryptedPassword = decryptedPassword;
    delete result.encryptedPassword;

    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/admin/accounts
 * Add single account manually
 */
export const createSingleAccount = async (req, res, next) => {
  try {
    const {
      productId,
      username,
      password,
      accountType = 'Premium',
      plan = 'Annual',
      loginUrl,
      expiresAt,
      notes,
      status = 'Available',
    } = req.body;

    if (!productId || !username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Product, username, and password are required',
      });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // Check duplicate username for this product
    const existing = await AccountInventory.findOne({
      product: productId,
      username: username.trim().toLowerCase(),
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: `An account with username "${username}" already exists for this product.`,
      });
    }

    const newAccount = await AccountInventory.createEncrypted({
      product: productId,
      username: username.trim(),
      plainPassword: password.trim(),
      accountType,
      plan,
      loginUrl: loginUrl || product.defaultAccessLink || '',
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      notes: notes || '',
      status,
      batchTag: 'SINGLE-MANUAL',
    });

    res.status(201).json({
      success: true,
      message: 'Account added successfully to inventory',
      data: {
        _id: newAccount._id,
        username: newAccount.username,
        accountType: newAccount.accountType,
        plan: newAccount.plan,
        status: newAccount.status,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/admin/accounts/preview
 * Preview bulk account import
 */
export const previewImport = async (req, res, next) => {
  try {
    const { productId, content, delimiter } = req.body;

    if (!productId || !content) {
      return res.status(400).json({
        success: false,
        message: 'Product ID and raw account content are required',
      });
    }

    const preview = await previewAccountImport({
      productId,
      content,
      delimiter: delimiter || null,
    });

    res.status(200).json({
      success: true,
      data: preview,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/admin/accounts/import
 * Commit previewed bulk accounts
 */
export const commitImport = async (req, res, next) => {
  try {
    const { productId, accounts, fileName, sourceType, batchTag } = req.body;

    if (!productId || !Array.isArray(accounts) || accounts.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Product ID and valid accounts array are required',
      });
    }

    const result = await commitAccountImport({
      productId,
      accounts,
      importedBy: req.user._id,
      fileName: fileName || 'bulk-import.txt',
      sourceType: sourceType || 'paste',
      batchTag: batchTag || `BATCH-${Date.now().toString(36).toUpperCase()}`,
    });

    res.status(201).json({
      success: true,
      message: `Successfully imported ${result.importedCount} accounts into inventory`,
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/admin/accounts/:id
 * Update account details, credentials or status
 */
export const updateAccount = async (req, res, next) => {
  try {
    const { username, password, accountType, plan, loginUrl, expiresAt, notes, status } =
      req.body;

    const account = await AccountInventory.findById(req.params.id);
    if (!account) {
      return res.status(404).json({ success: false, message: 'Account not found' });
    }

    if (username) account.username = username.trim();
    if (password && password.trim()) {
      account.encryptedPassword = encryptCredential(password.trim());
    }
    if (accountType !== undefined) account.accountType = accountType;
    if (plan !== undefined) account.plan = plan;
    if (loginUrl !== undefined) account.loginUrl = loginUrl;
    if (expiresAt !== undefined) account.expiresAt = expiresAt ? new Date(expiresAt) : null;
    if (notes !== undefined) account.notes = notes;
    if (status && ['Available', 'Reserved', 'Sold', 'Disabled', 'Expired'].includes(status)) {
      account.status = status;
    }

    await account.save();

    res.status(200).json({
      success: true,
      message: 'Account updated successfully',
      data: {
        _id: account._id,
        username: account.username,
        status: account.status,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/admin/accounts/:id
 * Delete or disable account
 */
export const deleteAccount = async (req, res, next) => {
  try {
    const account = await AccountInventory.findById(req.params.id);
    if (!account) {
      return res.status(404).json({ success: false, message: 'Account not found' });
    }

    if (account.status === 'Sold') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete an account that has already been delivered to a customer. Disable it instead.',
      });
    }

    await AccountInventory.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Account deleted from inventory successfully',
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/admin/accounts/bulk-action
 * Bulk disable or bulk delete unused accounts
 */
export const bulkActionAccounts = async (req, res, next) => {
  try {
    const { action, ids = [], productId } = req.body;

    if (!action) {
      return res.status(400).json({ success: false, message: 'Action is required' });
    }

    let modifiedCount = 0;

    if (action === 'disable') {
      const result = await AccountInventory.updateMany(
        { _id: { $in: ids }, status: { $ne: 'Sold' } },
        { $set: { status: 'Disabled' } }
      );
      modifiedCount = result.modifiedCount;
    } else if (action === 'delete_available') {
      const filter = { status: 'Available' };
      if (productId) filter.product = productId;
      if (ids.length > 0) filter._id = { $in: ids };

      const result = await AccountInventory.deleteMany(filter);
      modifiedCount = result.deletedCount;
    } else {
      return res.status(400).json({ success: false, message: 'Unsupported bulk action' });
    }

    res.status(200).json({
      success: true,
      message: `Bulk action "${action}" completed. Modified ${modifiedCount} accounts.`,
      modifiedCount,
    });
  } catch (err) {
    next(err);
  }
};

