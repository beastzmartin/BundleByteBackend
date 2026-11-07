import AccountInventory from '../models/AccountInventory.js';
import LicenseInventory from '../models/LicenseInventory.js';
import SoftwareLinkInventory from '../models/SoftwareLinkInventory.js';
import Product from '../models/Product.js';
import Category from '../models/Category.js';
import Order from '../models/Order.js';
import DeliveryHistory from '../models/DeliveryHistory.js';
import WhatsAppDelivery from '../models/WhatsAppDelivery.js';

/**
 * GET /api/admin/inventory/unified-stats
 * Aggregated telemetry across Accounts, License Keys, Activation Codes, Access Links, and Manual Delivery
 */
export const getUnifiedInventoryStats = async (req, res, next) => {
  try {
    const digitalAccountsCat = await Category.findOne({ name: 'Digital Accounts' });
    const digitalAccountsCatId = digitalAccountsCat ? digitalAccountsCat._id : null;

    // 1. Account inventory stats
    const [
      accTotal,
      accAvailable,
      accSold,
      accReserved,
      accDisabled,
      accExpired,
    ] = await Promise.all([
      AccountInventory.countDocuments(),
      AccountInventory.countDocuments({ status: 'Available' }),
      AccountInventory.countDocuments({ status: 'Sold' }),
      AccountInventory.countDocuments({ status: 'Reserved' }),
      AccountInventory.countDocuments({ status: 'Disabled' }),
      AccountInventory.countDocuments({ status: 'Expired' }),
    ]);

    // 2. License key stats
    const [
      licTotal,
      licAvailable,
      licSold,
      licReserved,
      licDisabled,
      licExpired,
    ] = await Promise.all([
      LicenseInventory.countDocuments(),
      LicenseInventory.countDocuments({ status: 'Available' }),
      LicenseInventory.countDocuments({ status: 'Sold' }),
      LicenseInventory.countDocuments({ status: 'Reserved' }),
      LicenseInventory.countDocuments({ status: 'Disabled' }),
      LicenseInventory.countDocuments({ status: 'Expired' }),
    ]);

    // 2.5 Software Access Links stats
    const [
      linkTotal,
      linkAvailable,
      linkSold,
      linkReserved,
      linkDisabled,
      linkExpired,
    ] = await Promise.all([
      SoftwareLinkInventory.countDocuments(),
      SoftwareLinkInventory.countDocuments({ status: 'Available' }),
      SoftwareLinkInventory.countDocuments({ status: 'Sold' }),
      SoftwareLinkInventory.countDocuments({ status: 'Reserved' }),
      SoftwareLinkInventory.countDocuments({ status: 'Disabled' }),
      SoftwareLinkInventory.countDocuments({ status: 'Expired' }),
    ]);

    // 3. Product delivery types distribution
    const accountOrConditions = [{ deliveryType: 'account_credentials' }];
    if (digitalAccountsCatId) {
      accountOrConditions.push({ category: digitalAccountsCatId });
    }

    const [
      accountProductsCount,
      licenseProductsCount,
      accessLinkProductsCount,
      manualProductsCount,
      whatsappProductsCount,
    ] = await Promise.all([
      Product.countDocuments({ $or: accountOrConditions }),
      Product.countDocuments({ deliveryType: 'license_key' }),
      Product.countDocuments({ deliveryType: 'access_link' }),
      Product.countDocuments({ deliveryMethod: 'manual' }),
      Product.countDocuments({ $or: [{ deliveryMethod: 'whatsapp_manual' }, { deliveryType: 'whatsapp_manual' }] }),
    ]);

    // 4. Pending delivery queues
    const [manualQueueCount, whatsappQueueCount] = await Promise.all([
      Order.countDocuments({ deliveryStatus: 'manual_queue' }),
      WhatsAppDelivery.countDocuments({ status: { $in: ['awaiting_whatsapp_contact', 'customer_contacted', 'processing'] } }),
    ]);

    // 5. Recent allocation logs
    const recentAllocations = await DeliveryHistory.find()
      .populate('product', 'title logo category')
      .populate('customer', 'name email')
      .sort({ createdAt: -1 })
      .limit(10);

    // 6. Products with low stock (< 5 available)
    const lowStockProducts = await Product.find({ status: 'active' }).select('title slug logo deliveryMethod deliveryType category');
    const lowStockAlerts = [];

    for (const prod of lowStockProducts) {
      const isAccount =
        prod.deliveryType === 'account_credentials' ||
        (digitalAccountsCatId && prod.category?.toString() === digitalAccountsCatId.toString());

      const available = isAccount
        ? await AccountInventory.countDocuments({ product: prod._id, status: 'Available' })
        : await LicenseInventory.countDocuments({ product: prod._id, status: 'Available' });

      if (available <= 5 && prod.deliveryMethod !== 'manual' && prod.deliveryMethod !== 'whatsapp_manual') {
        lowStockAlerts.push({
          productId: prod._id,
          title: prod.title,
          type: isAccount ? 'account' : 'license',
          availableCount: available,
        });
      }
    }

    res.status(200).json({
      success: true,
      data: {
        accounts: {
          total: accTotal,
          available: accAvailable,
          sold: accSold,
          reserved: accReserved,
          disabled: accDisabled,
          expired: accExpired,
        },
        licenses: {
          total: licTotal,
          available: licAvailable,
          sold: licSold,
          reserved: licReserved,
          disabled: licDisabled,
          expired: licExpired,
        },
        links: {
          total: linkTotal,
          available: linkAvailable,
          sold: linkSold,
          reserved: linkReserved,
          disabled: linkDisabled,
          expired: linkExpired,
        },
        productCounts: {
          accounts: accountProductsCount,
          licenseKeys: licenseProductsCount,
          accessLinks: accessLinkProductsCount,
          manual: manualProductsCount,
          whatsapp: whatsappProductsCount,
        },
        queues: {
          manualPending: manualQueueCount,
          whatsappPending: whatsappQueueCount,
        },
        lowStockAlerts,
        recentAllocations,
      },
    });
  } catch (err) {
    next(err);
  }
};
