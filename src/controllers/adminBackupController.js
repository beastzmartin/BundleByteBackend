import fs from 'fs';
import path from 'path';
import Product from '../models/Product.js';
import Category from '../models/Category.js';
import Order from '../models/Order.js';
import User from '../models/User.js';
import DigitalDelivery from '../models/DigitalDelivery.js';
import LicenseInventory from '../models/LicenseInventory.js';
import AccountInventory from '../models/AccountInventory.js';
import SoftwareLinkInventory from '../models/SoftwareLinkInventory.js';
import Coupon from '../models/Coupon.js';
import Review from '../models/Review.js';
import Payment from '../models/Payment.js';
import PaymentVerification from '../models/PaymentVerification.js';
import CustomPaymentMethod from '../models/CustomPaymentMethod.js';
import Wallet from '../models/Wallet.js';
import WalletTransaction from '../models/WalletTransaction.js';
import WebsiteSetting from '../models/WebsiteSetting.js';
import ThemeSettings from '../models/ThemeSettings.js';
import { logAudit } from '../middleware/audit.js';

let backupsDir = path.resolve(process.cwd(), 'backups');
try {
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }
} catch (_) {
  backupsDir = path.resolve('/tmp', 'backups');
  try { if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true }); } catch (_) {}
}

// Helper to escape CSV cell according to RFC 4180
const escapeCSV = (value) => {
  if (value === null || value === undefined) return '""';
  let str = String(value);
  if (typeof value === 'object') {
    try { str = JSON.stringify(value); } catch (_) { str = String(value); }
  }
  // Replace internal quotes with double quotes
  str = str.replace(/"/g, '""');
  return `"${str}"`;
};

// Convert array of objects to CSV string
const arrayToCSV = (items, headers) => {
  const headerRow = headers.map((h) => escapeCSV(h.label)).join(',');
  const rows = items.map((item) => {
    return headers.map((h) => escapeCSV(h.getter ? h.getter(item) : item[h.key])).join(',');
  });
  return [headerRow, ...rows].join('\r\n');
};

/**
 * GET /api/admin/backup/export
 * Export full database JSON snapshot or collection-specific CSV/JSON
 */
export const exportBackup = async (req, res, next) => {
  try {
    const { type = 'full', collection = 'all', format = 'json', dateFrom, dateTo } = req.query;

    const dateFilter = {};
    if (dateFrom) dateFilter.$gte = new Date(dateFrom);
    if (dateTo) dateFilter.$lte = new Date(dateTo);
    const dateQuery = Object.keys(dateFilter).length ? { createdAt: dateFilter } : {};

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

    // 1. FULL SYSTEM BACKUP SNAPSHOT (JSON)
    if (type === 'full') {
      const [
        products,
        categories,
        orders,
        users,
        deliveries,
        licenses,
        accounts,
        links,
        coupons,
        reviews,
        customPayments,
        verifications,
        settings,
        themes,
      ] = await Promise.all([
        Product.find().lean(),
        Category.find().lean(),
        Order.find().populate('items').lean(),
        User.find().select('-password').lean(),
        DigitalDelivery.find().lean(),
        LicenseInventory.find().lean(),
        AccountInventory.find().lean(),
        SoftwareLinkInventory.find().lean(),
        Coupon.find().lean(),
        Review.find().lean(),
        CustomPaymentMethod.find().lean(),
        PaymentVerification.find().lean(),
        WebsiteSetting.findOne().lean(),
        ThemeSettings.findOne().lean(),
      ]);

      const backupData = {
        metadata: {
          platform: 'BundleByte Digital Marketplace',
          version: '2.0.0',
          exportedAt: new Date().toISOString(),
          exportedBy: req.user?.email || 'admin',
          recordCounts: {
            products: products.length,
            categories: categories.length,
            orders: orders.length,
            users: users.length,
            deliveries: deliveries.length,
            licenses: licenses.length,
            accounts: accounts.length,
            links: links.length,
            coupons: coupons.length,
            reviews: reviews.length,
            customPayments: customPayments.length,
            verifications: verifications.length,
          },
        },
        data: {
          products,
          categories,
          orders,
          users,
          deliveries,
          licenses,
          accounts,
          links,
          coupons,
          reviews,
          customPayments,
          verifications,
          settings,
          themes,
        },
      };

      const filename = `bundlebyte-full-backup-${timestamp}.json`;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.status(200).send(JSON.stringify(backupData, null, 2));
    }

    // 2. COLLECTION-SPECIFIC EXPORTS (CSV or JSON)
    const target = collection.toLowerCase();

    // ORDERS
    if (target === 'orders') {
      const orders = await Order.find(dateQuery).populate('user', 'name email').sort({ createdAt: -1 }).lean();

      if (format === 'csv') {
        const headers = [
          { key: 'orderNumber', label: 'Order Number' },
          { key: 'createdAt', label: 'Order Date', getter: (o) => new Date(o.createdAt).toLocaleString('en-IN') },
          { key: 'customerName', label: 'Customer Name', getter: (o) => o.customerName || o.user?.name || '' },
          { key: 'customerEmail', label: 'Customer Email', getter: (o) => o.customerEmail || o.user?.email || '' },
          { key: 'totalAmount', label: 'Total Amount (INR)' },
          { key: 'currency', label: 'Billing Currency' },
          { key: 'paymentStatus', label: 'Payment Status' },
          { key: 'deliveryStatus', label: 'Delivery Status' },
          { key: 'gateway', label: 'Payment Gateway', getter: (o) => o.paymentMethod || o.paymentDetails?.gateway || '' },
          { key: 'items', label: 'Items Purchased', getter: (o) => (o.items || []).map((it) => `${it.productTitle || it.slug} (x${it.quantity})`).join('; ') },
        ];
        const csvContent = arrayToCSV(orders, headers);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="bundlebyte-orders-${timestamp}.csv"`);
        return res.status(200).send(csvContent);
      }

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="bundlebyte-orders-${timestamp}.json"`);
      return res.status(200).send(JSON.stringify(orders, null, 2));
    }

    // PRODUCTS CATALOG
    if (target === 'products') {
      const products = await Product.find(dateQuery).populate('category', 'name').lean();

      if (format === 'csv') {
        const headers = [
          { key: 'title', label: 'Product Title' },
          { key: 'slug', label: 'Slug / URL Key' },
          { key: 'sku', label: 'SKU' },
          { key: 'category', label: 'Category', getter: (p) => p.category?.name || '' },
          { key: 'licenseType', label: 'License Type' },
          { key: 'price', label: 'Base Price (INR)' },
          { key: 'stock', label: 'Stock Available' },
          { key: 'isActive', label: 'Active Status' },
          { key: 'isFeatured', label: 'Featured' },
          { key: 'createdAt', label: 'Created Date', getter: (p) => new Date(p.createdAt).toISOString() },
        ];
        const csvContent = arrayToCSV(products, headers);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="bundlebyte-products-${timestamp}.csv"`);
        return res.status(200).send(csvContent);
      }

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="bundlebyte-products-${timestamp}.json"`);
      return res.status(200).send(JSON.stringify(products, null, 2));
    }

    // CUSTOMERS & USERS
    if (target === 'customers' || target === 'users') {
      const users = await User.find(dateQuery).select('-password').sort({ createdAt: -1 }).lean();

      if (format === 'csv') {
        const headers = [
          { key: 'name', label: 'Full Name' },
          { key: 'email', label: 'Email Address' },
          { key: 'phone', label: 'Phone Number' },
          { key: 'role', label: 'Role' },
          { key: 'isEmailVerified', label: 'Email Verified' },
          { key: 'authProviders', label: 'Sign-in Providers', getter: (u) => (u.authProviders || []).join(', ') },
          { key: 'createdAt', label: 'Joined At', getter: (u) => new Date(u.createdAt).toLocaleString('en-IN') },
        ];
        const csvContent = arrayToCSV(users, headers);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="bundlebyte-customers-${timestamp}.csv"`);
        return res.status(200).send(csvContent);
      }

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="bundlebyte-customers-${timestamp}.json"`);
      return res.status(200).send(JSON.stringify(users, null, 2));
    }

    // LICENSE INVENTORY POOL
    if (target === 'licenses' || target === 'inventory') {
      const licenses = await LicenseInventory.find(dateQuery).populate('product', 'title slug').lean();

      if (format === 'csv') {
        const headers = [
          { key: 'productTitle', label: 'Product Name', getter: (l) => l.product?.title || l.productTitle || '' },
          { key: 'licenseKey', label: 'License Key' },
          { key: 'status', label: 'Inventory Status' },
          { key: 'batchId', label: 'Import Batch' },
          { key: 'allocatedToOrder', label: 'Order Allocated' },
          { key: 'createdAt', label: 'Added Date', getter: (l) => new Date(l.createdAt).toISOString() },
        ];
        const csvContent = arrayToCSV(licenses, headers);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="bundlebyte-licenses-${timestamp}.csv"`);
        return res.status(200).send(csvContent);
      }

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="bundlebyte-licenses-${timestamp}.json"`);
      return res.status(200).send(JSON.stringify(licenses, null, 2));
    }

    // DELIVERIES & DIGITAL VAULT
    if (target === 'deliveries') {
      const deliveries = await DigitalDelivery.find(dateQuery).populate('user', 'name email').lean();

      if (format === 'csv') {
        const headers = [
          { key: 'deliveryId', label: 'Delivery Ref' },
          { key: 'productTitle', label: 'Product' },
          { key: 'customer', label: 'Customer', getter: (d) => d.user?.email || '' },
          { key: 'licenseKey', label: 'Delivered Key' },
          { key: 'deliveryType', label: 'Type' },
          { key: 'deliveredAt', label: 'Delivered At', getter: (d) => new Date(d.deliveredAt).toLocaleString('en-IN') },
        ];
        const csvContent = arrayToCSV(deliveries, headers);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="bundlebyte-deliveries-${timestamp}.csv"`);
        return res.status(200).send(csvContent);
      }

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="bundlebyte-deliveries-${timestamp}.json"`);
      return res.status(200).send(JSON.stringify(deliveries, null, 2));
    }

    // PAYMENTS & VERIFICATIONS
    if (target === 'payments') {
      const verifications = await PaymentVerification.find(dateQuery).populate('user', 'name email').lean();

      if (format === 'csv') {
        const headers = [
          { key: 'referenceCode', label: 'Reference Code' },
          { key: 'transactionId', label: 'UTR / TxID' },
          { key: 'customer', label: 'Customer', getter: (v) => v.user?.email || '' },
          { key: 'amount', label: 'Amount' },
          { key: 'currency', label: 'Currency' },
          { key: 'paymentType', label: 'Gateway Type' },
          { key: 'status', label: 'Status' },
          { key: 'senderName', label: 'Payer Name' },
          { key: 'createdAt', label: 'Date', getter: (v) => new Date(v.createdAt).toLocaleString('en-IN') },
        ];
        const csvContent = arrayToCSV(verifications, headers);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="bundlebyte-payments-${timestamp}.csv"`);
        return res.status(200).send(csvContent);
      }

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="bundlebyte-payments-${timestamp}.json"`);
      return res.status(200).send(JSON.stringify(verifications, null, 2));
    }

    return res.status(400).json({ success: false, message: `Unsupported collection '${collection}' for export.` });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/backup/snapshots
 * List on-disk backup snapshots
 */
export const getBackupSnapshots = async (req, res, next) => {
  try {
    const snapshots = [];
    if (fs.existsSync(backupsDir)) {
      const files = fs.readdirSync(backupsDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(backupsDir, file);
          try {
            const stat = fs.statSync(filePath);
            snapshots.push({
              filename: file,
              sizeBytes: stat.size,
              formattedSize: `${(stat.size / (1024 * 1024)).toFixed(2)} MB`,
              createdAt: stat.mtime,
            });
          } catch (_) {}
        }
      }
    }

    snapshots.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.status(200).json({ success: true, snapshots });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/backup/create-snapshot
 * Generate and store a complete JSON backup snapshot on disk
 */
export const createBackupSnapshot = async (req, res, next) => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `snapshot-${timestamp}.json`;
    const filePath = path.join(backupsDir, filename);

    const [
      products,
      categories,
      orders,
      users,
      deliveries,
      licenses,
      accounts,
      links,
      coupons,
      reviews,
      customPayments,
      verifications,
      settings,
      themes,
    ] = await Promise.all([
      Product.find().lean(),
      Category.find().lean(),
      Order.find().lean(),
      User.find().select('-password').lean(),
      DigitalDelivery.find().lean(),
      LicenseInventory.find().lean(),
      AccountInventory.find().lean(),
      SoftwareLinkInventory.find().lean(),
      Coupon.find().lean(),
      Review.find().lean(),
      CustomPaymentMethod.find().lean(),
      PaymentVerification.find().lean(),
      WebsiteSetting.findOne().lean(),
      ThemeSettings.findOne().lean(),
    ]);

    const snapshot = {
      metadata: {
        platform: 'BundleByte Digital Marketplace',
        version: '2.0.0',
        exportedAt: new Date().toISOString(),
        exportedBy: req.user?.email || 'admin',
        totalRecords: products.length + orders.length + users.length + deliveries.length,
      },
      data: {
        products,
        categories,
        orders,
        users,
        deliveries,
        licenses,
        accounts,
        links,
        coupons,
        reviews,
        customPayments,
        verifications,
        settings,
        themes,
      },
    };

    fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2), 'utf-8');
    const stat = fs.statSync(filePath);

    await logAudit({
      actor: req.user?._id,
      actorEmail: req.user?.email,
      actorRole: req.user?.role,
      action: 'BACKUP_SNAPSHOT_CREATED',
      entity: 'SystemBackup',
      metadata: { filename, sizeBytes: stat.size },
      req,
    }).catch(() => {});

    res.status(201).json({
      success: true,
      message: 'System backup snapshot generated successfully!',
      snapshot: {
        filename,
        sizeBytes: stat.size,
        formattedSize: `${(stat.size / (1024 * 1024)).toFixed(2)} MB`,
        createdAt: stat.mtime,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/backup/import/validate
 * Dry-run inspects and validates an uploaded JSON/CSV import file
 */
export const validateImport = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload a JSON or CSV backup file.' });
    }

    const fileContent = fs.readFileSync(req.file.path, 'utf-8');
    const ext = path.extname(req.file.originalname).toLowerCase();

    // 1. JSON FILE VALIDATION
    if (ext === '.json') {
      let parsed;
      try {
        parsed = JSON.parse(fileContent);
      } catch (err) {
        return res.status(400).json({ success: false, message: 'Invalid JSON format in uploaded file.' });
      }

      // Check if full backup snapshot
      if (parsed.data && typeof parsed.data === 'object') {
        const counts = {};
        for (const [key, val] of Object.entries(parsed.data)) {
          if (Array.isArray(val)) counts[key] = val.length;
          else if (val) counts[key] = 1;
        }

        return res.status(200).json({
          success: true,
          type: 'full_backup_json',
          totalCollections: Object.keys(counts).length,
          recordCounts: counts,
          metadata: parsed.metadata || {},
          isValid: true,
        });
      }

      // Or an array of items (e.g. products or licenses)
      if (Array.isArray(parsed)) {
        return res.status(200).json({
          success: true,
          type: 'array_json',
          totalCount: parsed.length,
          sample: parsed.slice(0, 3),
          isValid: true,
        });
      }
    }

    // 2. CSV FILE VALIDATION
    if (ext === '.csv') {
      const lines = fileContent.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length < 2) {
        return res.status(400).json({ success: false, message: 'CSV file must have a header row and at least one data row.' });
      }

      const headers = lines[0].split(',').map((h) => h.replace(/^["']|["']$/g, '').trim());
      return res.status(200).json({
        success: true,
        type: 'csv',
        totalRows: lines.length - 1,
        headers,
        sampleRow: lines[1],
        isValid: true,
      });
    }

    return res.status(400).json({ success: false, message: 'Unsupported file format. Please upload .json or .csv.' });
  } catch (error) {
    next(error);
  } finally {
    if (req.file?.path && fs.existsSync(req.file.path)) {
      try { fs.unlinkSync(req.file.path); } catch (_) {}
    }
  }
};

/**
 * POST /api/admin/backup/import/execute
 * Execute import of full backup JSON or specific dataset
 */
export const executeImport = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload an import file.' });
    }

    const { mode = 'merge', targetCollection = 'auto' } = req.body;
    const fileContent = fs.readFileSync(req.file.path, 'utf-8');
    const ext = path.extname(req.file.originalname).toLowerCase();

    if (ext !== '.json') {
      return res.status(400).json({
        success: false,
        message: 'Currently Full JSON snapshots and JSON array imports are supported for automated atomic restore.',
      });
    }

    let parsed;
    try {
      parsed = JSON.parse(fileContent);
    } catch (_) {
      return res.status(400).json({ success: false, message: 'Malformed JSON file' });
    }

    const importedStats = {};

    // 1. FULL BACKUP RESTORE
    if (parsed.data && typeof parsed.data === 'object') {
      const {
        products,
        categories,
        coupons,
        customPayments,
        licenses,
      } = parsed.data;

      // Categories
      if (Array.isArray(categories) && categories.length > 0) {
        let catCount = 0;
        for (const cat of categories) {
          const { _id, ...rest } = cat;
          if (rest.slug) {
            await Category.findOneAndUpdate({ slug: rest.slug }, rest, { upsert: true, new: true });
            catCount++;
          }
        }
        importedStats.categories = catCount;
      }

      // Products
      if (Array.isArray(products) && products.length > 0) {
        let prodCount = 0;
        for (const prod of products) {
          const { _id, ...rest } = prod;
          if (rest.slug) {
            await Product.findOneAndUpdate({ slug: rest.slug }, rest, { upsert: true, new: true });
            prodCount++;
          }
        }
        importedStats.products = prodCount;
      }

      // Coupons
      if (Array.isArray(coupons) && coupons.length > 0) {
        let couponCount = 0;
        for (const cp of coupons) {
          const { _id, ...rest } = cp;
          if (rest.code) {
            await Coupon.findOneAndUpdate({ code: rest.code }, rest, { upsert: true, new: true });
            couponCount++;
          }
        }
        importedStats.coupons = couponCount;
      }

      // Custom Payment Methods
      if (Array.isArray(customPayments) && customPayments.length > 0) {
        let cpCount = 0;
        for (const cp of customPayments) {
          const { _id, ...rest } = cp;
          if (rest.code) {
            await CustomPaymentMethod.findOneAndUpdate({ code: rest.code }, rest, { upsert: true, new: true });
            cpCount++;
          }
        }
        importedStats.customPayments = cpCount;
      }

      // License Inventory Keys
      if (Array.isArray(licenses) && licenses.length > 0) {
        let licCount = 0;
        for (const lic of licenses) {
          const { _id, ...rest } = lic;
          if (rest.licenseKey) {
            const exists = await LicenseInventory.findOne({ licenseKey: rest.licenseKey });
            if (!exists) {
              await LicenseInventory.create(rest);
              licCount++;
            }
          }
        }
        importedStats.licenses = licCount;
      }

      await logAudit({
        actor: req.user?._id,
        actorEmail: req.user?.email,
        actorRole: req.user?.role,
        action: 'DATA_RESTORED_FROM_BACKUP',
        entity: 'SystemBackup',
        metadata: { importedStats, mode },
        req,
      }).catch(() => {});

      return res.status(200).json({
        success: true,
        message: 'Full backup restore executed successfully!',
        importedStats,
      });
    }

    // 2. PRODUCT ARRAY IMPORT
    if (Array.isArray(parsed)) {
      let count = 0;
      for (const item of parsed) {
        if (item.slug && item.title) {
          const { _id, ...rest } = item;
          await Product.findOneAndUpdate({ slug: rest.slug }, rest, { upsert: true, new: true });
          count++;
        }
      }
      return res.status(200).json({
        success: true,
        message: `Successfully imported / synced ${count} products.`,
        count,
      });
    }

    return res.status(400).json({ success: false, message: 'Unrecognized backup structure.' });
  } catch (error) {
    next(error);
  } finally {
    if (req.file?.path && fs.existsSync(req.file.path)) {
      try { fs.unlinkSync(req.file.path); } catch (_) {}
    }
  }
};

