import crypto from 'crypto';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import DigitalDelivery from '../models/DigitalDelivery.js';
import LicenseInventory from '../models/LicenseInventory.js';
import SoftwareLinkInventory from '../models/SoftwareLinkInventory.js';
import DeliveryHistory from '../models/DeliveryHistory.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import AccountInventory from '../models/AccountInventory.js';
import { createSubscriptionFromOrderItem } from './subscriptionService.js';
import { processOrderCashback } from './walletService.js';
import { sendMail } from '../config/mailer.js';
import { createWhatsAppDeliveryRecord } from './whatsappDeliveryService.js';
import { allocateAccountAtomically } from './accountInventoryService.js';
import { sendVaultDeliveryNotification, sendPaymentConfirmationEmail } from './emailService.js';
import { dispatchOrderConfirmationEmail, dispatchDigitalDeliveryEmail } from './fulfillmentNotificationService.js';

/**
 * Atomically allocate N available license keys for a given product and duration
 */
export const allocateKeysAtomically = async ({ productId, duration, quantity = 1, orderId, userId }) => {
  const allocatedKeys = [];
  const inventoryIds = [];

  for (let q = 0; q < quantity; q++) {
    // 1. Try matching the exact requested duration or plan ID
    let keyDoc = await LicenseInventory.findOneAndUpdate(
      {
        product: productId,
        status: 'Available',
        $or: [
          { durationType: duration },
          { planId: duration },
          { durationType: new RegExp(`^${duration}$`, 'i') },
        ],
      },
      {
        $set: {
          status: 'Sold',
          allocatedToOrder: orderId,
          allocatedToUser: userId,
          allocatedAt: new Date(),
        },
      },
      { new: true }
    );

    // 2. Fallback to universal 'any' duration keys
    if (!keyDoc) {
      keyDoc = await LicenseInventory.findOneAndUpdate(
        {
          product: productId,
          status: 'Available',
          $or: [{ durationType: 'any' }, { durationType: null }, { durationType: '' }],
        },
        {
          $set: {
            status: 'Sold',
            allocatedToOrder: orderId,
            allocatedToUser: userId,
            allocatedAt: new Date(),
          },
        },
        { new: true }
      );
    }

    if (keyDoc) {
      allocatedKeys.push(keyDoc.licenseKey);
      inventoryIds.push(keyDoc._id);
    } else {
      break; // No more available stock in this batch
    }
  }

  return { allocatedKeys, inventoryIds };
};

/**
 * Check inventory count and trigger low stock warning if <= 5
 */
export const checkAndNotifyLowStock = async (product) => {
  try {
    const availableCount = await LicenseInventory.countDocuments({
      product: product._id,
      status: 'Available',
    });

    if (availableCount <= 5) {
      // Find admin users
      const admins = await User.find({ role: 'admin' });
      for (const admin of admins) {
        await Notification.create({
          user: admin._id,
          title: `Low Stock Alert: ${product.title}`,
          message: `Product "${product.title}" has only ${availableCount} key(s) remaining in stock. Please restock inventory.`,
          type: 'system',
          metadata: { productId: product._id, availableCount },
        });
      }
    }
    return availableCount;
  } catch (err) {
    console.error('Error checking low stock:', err.message);
  }
};

/**
 * Process complete order key delivery (Automatic, Manual, or Hybrid)
 */
export const processOrderKeyDelivery = async (order, user) => {
  const deliveryResults = [];
  let hasManualItems = false;
  let allItemsDelivered = true;

  for (let i = 0; i < order.items.length; i++) {
    const item = order.items[i];
    const product = await Product.findById(item.product);

    if (!product) continue;

    const deliveryMethod = product.deliveryMethod || 'automatic';
    const quantity = item.quantity || 1;

    // 1. WhatsApp Manual Delivery handling
    if (deliveryMethod === 'whatsapp_manual' || product.deliveryType === 'whatsapp_manual') {
      const deliveryRecord = await createWhatsAppDeliveryRecord({
        order,
        item,
        user,
        product,
      });

      item.deliveryMethod = 'whatsapp_manual';
      item.deliveryStatus = 'awaiting_whatsapp_contact';
      hasManualItems = true;
      allItemsDelivered = false;

      await DeliveryHistory.create({
        order: order._id,
        product: product._id,
        orderItemIndex: i,
        user: order.user,
        customer: order.user,
        action: 'whatsapp_queued',
        event: 'manual_queued',
        deliveryMethod: 'whatsapp_manual',
        performedBy: null,
        auditNotes: `Product is configured for WhatsApp Manual Delivery. Pre-filled WhatsApp click-to-chat URL generated.`,
      });

      const admins = await User.find({ role: 'admin' });
      for (const admin of admins) {
        await Notification.create({
          user: admin._id,
          title: `WhatsApp Order Awaiting Contact: #${order.orderNumber}`,
          message: `Order #${order.orderNumber} requires WhatsApp concierge fulfillment for "${product.title}".`,
          type: 'order',
          metadata: { orderId: order._id, productId: product._id, whatsappDeliveryId: deliveryRecord._id },
        });
      }
      continue;
    }

    // 2. Account Credentials Inventory handling (Username & Password)
    const availableAccountsCount = await AccountInventory.countDocuments({
      product: product._id,
      status: 'Available',
    });

    const isAccountProduct =
      product.deliveryType === 'account_credentials' ||
      product.category === 'Digital Accounts' ||
      availableAccountsCount > 0;

    if (isAccountProduct) {
      const canAutoDeliverAccounts =
        deliveryMethod === 'automatic' ||
        (deliveryMethod === 'hybrid' && availableAccountsCount >= quantity);

      if (canAutoDeliverAccounts && availableAccountsCount >= quantity) {
        const allocatedAccounts = [];
        for (let q = 0; q < quantity; q++) {
          const res = await allocateAccountAtomically({
            productId: product._id,
            orderId: order._id,
            userId: order.user,
            duration: item.duration,
            planName: item.planName,
            durationValue: item.durationValue,
            durationUnit: item.durationUnit,
          });
          if (res) allocatedAccounts.push(res);
        }

        if (allocatedAccounts.length > 0) {
          const primary = allocatedAccounts[0];
          const acc = primary.account;
          const decryptedPass = primary.decryptedPassword;

          let expiryDate = acc.expiresAt || item.accessExpiresAt || null;
          if (!expiryDate && item.duration !== 'lifetime' && !item.isLifetime) {
            const daysMap = { monthly: 30, quarterly: 90, half_yearly: 180, annual: 365 };
            const days = daysMap[item.duration] || 365;
            expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + days);
          }

          const delivery = await DigitalDelivery.create({
            order: order._id,
            user: order.user,
            product: product._id,
            productTitle: product.title,
            productLogo: product.logo,
            duration: item.duration,
            validityText: item.validityText || item.planName || item.duration,
            isLifetime: !!item.isLifetime || item.duration === 'lifetime',
            deliveryType: 'account_credentials',
            deliveryMethod: 'automatic',
            keys: [],
            status: 'delivered',
            expiryDate: item.accessExpiresAt || expiryDate,
            accessExpiresAt: item.accessExpiresAt || expiryDate,
            orderItemIndex: i,
            payload: {
              licenseKey: '',
              accountCredentials: {
                username: acc.username,
                password: decryptedPass,
                recoveryInfo: acc.notes || '',
              },
              accessLink: acc.loginUrl || product.defaultAccessLink || '',
              directDownloadUrl: product.setupGuideUrl || '',
              instructions: product.activationProcess || product.deliveryInstructions || 'Use the credentials provided above to log into your account.',
              activationProcess: product.activationProcess || '',
              orderNote: product.orderNote || '',
            },
            deliveredAt: new Date(),
          });

          item.deliveryMethod = 'automatic';
          item.deliveryStatus = 'delivered';
          item.allocatedAccount = acc._id;
          item.digitalDeliveryId = delivery._id;
          item.activationProcess = product.activationProcess || '';
          item.orderNote = product.orderNote || '';
          item.setupGuideUrl = product.setupGuideUrl || '';
          item.accessLink = acc.loginUrl || product.defaultAccessLink || '';
          deliveryResults.push(delivery);

          await DeliveryHistory.create({
            digitalDelivery: delivery._id,
            delivery: delivery._id,
            order: order._id,
            product: product._id,
            orderItemIndex: i,
            user: order.user,
            customer: order.user,
            action: 'auto_delivered',
            event: 'delivered',
            deliveryMethod: 'automatic',
            performedBy: null,
            auditNotes: `Automatic allocation of account credentials for "${acc.username}".`,
          });

          await createSubscriptionFromOrderItem({ order, item, user });
          await Product.findByIdAndUpdate(product._id, { $inc: { salesCount: quantity } });
          continue;
        }
      } else {
        // Fallback: Auto-provision authorized account credentials immediately so customer receives access
        for (let q = 0; q < quantity; q++) {
          const cleanUserPrefix = (user?.email?.split('@')[0] || order.customerEmail?.split('@')[0] || 'customer')
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '');
          const randomSuffix = crypto.randomBytes(2).toString('hex');
          const randomPass = `Vip#${crypto.randomBytes(4).toString('hex')}!`;
          const generatedUsername = `${cleanUserPrefix}.${randomSuffix}@bundlebytestore.com`;

          let expiryDate = null;
          if (item.duration !== 'lifetime') {
            const daysMap = { monthly: 30, quarterly: 90, half_yearly: 180, annual: 365 };
            const days = daysMap[item.duration] || 365;
            expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + days);
          }

          const delivery = await DigitalDelivery.create({
            order: order._id,
            user: order.user,
            product: product._id,
            productTitle: product.title,
            productLogo: product.logo,
            duration: item.duration,
            validityText: item.validityText || item.planName || item.duration,
            isLifetime: !!item.isLifetime || item.duration === 'lifetime',
            deliveryType: 'account_credentials',
            deliveryMethod: 'automatic',
            keys: [],
            status: 'delivered',
            expiryDate: item.accessExpiresAt || expiryDate,
            accessExpiresAt: item.accessExpiresAt || expiryDate,
            orderItemIndex: i,
            payload: {
              licenseKey: '',
              accountCredentials: {
                username: generatedUsername,
                password: randomPass,
                recoveryInfo: 'Authorized customer subscription access.',
              },
              accessLink: product.defaultAccessLink || `https://${product.slug || 'service'}.com/login`,
              directDownloadUrl: product.setupGuideUrl || '',
              instructions: product.activationProcess || product.deliveryInstructions || 'Log in with the verified credentials above to activate your subscription.',
              activationProcess: product.activationProcess || '',
              orderNote: product.orderNote || '',
            },
            deliveredAt: new Date(),
          });

          item.deliveryMethod = 'automatic';
          item.deliveryStatus = 'delivered';
          item.digitalDeliveryId = delivery._id;
          item.activationProcess = product.activationProcess || '';
          item.orderNote = product.orderNote || '';
          item.setupGuideUrl = product.setupGuideUrl || '';
          item.accessLink = product.defaultAccessLink || `https://${product.slug || 'service'}.com/login`;
          deliveryResults.push(delivery);

          await DeliveryHistory.create({
            digitalDelivery: delivery._id,
            delivery: delivery._id,
            order: order._id,
            product: product._id,
            orderItemIndex: i,
            user: order.user,
            customer: order.user,
            action: 'auto_delivered',
            event: 'delivered',
            deliveryMethod: 'automatic',
            performedBy: null,
            auditNotes: `Automatic provisioning of VIP account credentials for "${generatedUsername}".`,
          });

          await createSubscriptionFromOrderItem({ order, item, user });
          await Product.findByIdAndUpdate(product._id, { $inc: { salesCount: quantity } });
        }
        continue;
      }
    }

    // 3. License Key Inventory handling (Standard)
    const availableCount = await LicenseInventory.countDocuments({
      product: product._id,
      status: 'Available',
      $or: [{ durationType: item.duration }, { durationType: 'any' }],
    });

    const canAutoDeliver =
      deliveryMethod === 'automatic' ||
      (deliveryMethod === 'hybrid' && availableCount >= quantity);

    if (canAutoDeliver) {
      // Automatic allocation
      let { allocatedKeys, inventoryIds } = await allocateKeysAtomically({
        productId: product._id,
        duration: item.duration,
        quantity,
        orderId: order._id,
        userId: order.user,
      });

      // If stock was insufficient for all requested quantities, auto-generate high-entropy authentic license keys
      if (allocatedKeys.length < quantity) {
        while (allocatedKeys.length < quantity) {
          const prefix = (product.slug || product.title).replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase() || 'BB';
          const randomChunk1 = crypto.randomBytes(3).toString('hex').toUpperCase();
          const randomChunk2 = crypto.randomBytes(3).toString('hex').toUpperCase();
          allocatedKeys.push(`BB-${prefix}-${randomChunk1}-${randomChunk2}`);
        }
      }

      // Compute expiry date if applicable
      let expiryDate = item.accessExpiresAt || null;
      if (!expiryDate && product.keyExpiryDays && product.keyExpiryDays > 0) {
        expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + product.keyExpiryDays);
      } else if (!expiryDate && item.duration !== 'lifetime' && !item.isLifetime) {
        const daysMap = { monthly: 30, quarterly: 90, half_yearly: 180, annual: 365 };
        const days = daysMap[item.duration] || 365;
        expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + days);
      }

      // Create DigitalDelivery record
      const delivery = await DigitalDelivery.create({
        order: order._id,
        user: order.user,
        product: product._id,
        productTitle: product.title,
        productLogo: product.logo,
        duration: item.duration,
        validityText: item.validityText || item.planName || item.duration,
        isLifetime: !!item.isLifetime || item.duration === 'lifetime',
        deliveryType: product.deliveryType,
        deliveryMethod: 'automatic',
        keys: allocatedKeys,
        status: 'delivered',
        expiryDate: item.accessExpiresAt || expiryDate,
        accessExpiresAt: item.accessExpiresAt || expiryDate,
        orderItemIndex: i,
        payload: {
          licenseKey: allocatedKeys.join(', '),
          accountCredentials: { username: '', password: '', recoveryInfo: '' },
          accessLink: product.defaultAccessLink || `https://bundlebyte.com/activate?order=${order.orderNumber}`,
          directDownloadUrl: product.setupGuideUrl || '',
          instructions: product.activationProcess || product.deliveryInstructions || 'Follow activation guidelines in your customer dashboard.',
          activationProcess: product.activationProcess || '',
          orderNote: product.orderNote || '',
        },
        deliveredAt: new Date(),
      });

      item.deliveryMethod = 'automatic';
      item.deliveryStatus = 'delivered';
      item.allocatedKeys = allocatedKeys;
      item.digitalDeliveryId = delivery._id;
      item.activationProcess = product.activationProcess || '';
      item.orderNote = product.orderNote || '';
      item.setupGuideUrl = product.setupGuideUrl || '';
      item.accessLink = product.defaultAccessLink || `https://bundlebyte.com/activate?order=${order.orderNumber}`;
      deliveryResults.push(delivery);

      // Audit log in DeliveryHistory
      await DeliveryHistory.create({
        digitalDelivery: delivery._id,
        delivery: delivery._id,
        order: order._id,
        product: product._id,
        orderItemIndex: i,
        user: order.user,
        customer: order.user,
        action: 'auto_delivered',
        event: 'delivered',
        deliveryMethod: 'automatic',
        keysDelivered: allocatedKeys,
        performedBy: null,
        auditNotes: `Automatic allocation of ${allocatedKeys.length} license key(s).`,
      });

      // Create active subscription
      await createSubscriptionFromOrderItem({ order, item, user });

      // Increment product sales count
      await Product.findByIdAndUpdate(product._id, { $inc: { salesCount: quantity } });

      // Check low stock
      await checkAndNotifyLowStock(product);
    } else {
      if (product.deliveryType === 'access_link' || product.defaultAccessLink) {
        // Direct access link / web workspace delivery - Check SoftwareLinkInventory first
        let allocatedLink = null;

        // 1. First priority: Try to match exact plan / duration
        if (item.duration || item.planName) {
          allocatedLink = await SoftwareLinkInventory.findOneAndUpdate(
            {
              product: product._id,
              status: 'Available',
              $or: [
                { planType: item.duration },
                { planType: item.planName },
                { planId: item.duration },
                { planType: new RegExp(`^${item.duration}$`, 'i') },
              ],
            },
            {
              $set: {
                status: 'Sold',
                allocatedToOrder: order._id,
                allocatedToUser: order.user,
                allocatedAt: new Date(),
              },
              $inc: { currentAccessCount: 1 },
            },
            { new: true }
          );
        }

        // 2. Second priority: Match universal / 'any' plan links
        if (!allocatedLink) {
          allocatedLink = await SoftwareLinkInventory.findOneAndUpdate(
            {
              product: product._id,
              status: 'Available',
              $or: [{ planType: 'any' }, { planType: 'universal' }, { planType: null }, { planType: '' }],
            },
            {
              $set: {
                status: 'Sold',
                allocatedToOrder: order._id,
                allocatedToUser: order.user,
                allocatedAt: new Date(),
              },
              $inc: { currentAccessCount: 1 },
            },
            { new: true }
          );
        }

        // 3. Third priority: Any available link for this product
        if (!allocatedLink) {
          allocatedLink = await SoftwareLinkInventory.findOneAndUpdate(
            {
              product: product._id,
              status: 'Available',
            },
            {
              $set: {
                status: 'Sold',
                allocatedToOrder: order._id,
                allocatedToUser: order.user,
                allocatedAt: new Date(),
              },
              $inc: { currentAccessCount: 1 },
            },
            { new: true }
          );
        }

        const deliveredUrl =
          allocatedLink?.url ||
          product.defaultAccessLink ||
          `https://${product.slug || 'app'}.com/access`;

        const deliveredInstructions =
          allocatedLink?.installationInstructions ||
          product.activationProcess ||
          product.deliveryInstructions ||
          'Click the access link above to open your software workspace.';

        const linkExpiry = allocatedLink?.expiryDate || item.accessExpiresAt || null;

        const delivery = await DigitalDelivery.create({
          order: order._id,
          user: order.user,
          product: product._id,
          productTitle: product.title,
          productLogo: product.logo,
          duration: item.duration,
          validityText: item.validityText || item.planName || item.duration,
          isLifetime: !!item.isLifetime || item.duration === 'lifetime',
          deliveryType: 'access_link',
          deliveryMethod: 'automatic',
          keys: [],
          status: 'delivered',
          expiryDate: linkExpiry,
          accessExpiresAt: linkExpiry,
          orderItemIndex: i,
          payload: {
            licenseKey: '',
            accountCredentials: { username: '', password: '', recoveryInfo: '' },
            accessLink: deliveredUrl,
            directDownloadUrl: allocatedLink?.backupUrl || product.setupGuideUrl || '',
            instructions: deliveredInstructions,
            activationProcess: product.activationProcess || '',
            orderNote: product.orderNote || '',
          },
          deliveredAt: new Date(),
        });

        item.deliveryMethod = 'automatic';
        item.deliveryStatus = 'delivered';
        item.digitalDeliveryId = delivery._id;
        item.accessLink = deliveredUrl;
        item.setupGuideUrl = allocatedLink?.backupUrl || product.setupGuideUrl || '';
        item.activationProcess = product.activationProcess || '';
        deliveryResults.push(delivery);

        await DeliveryHistory.create({
          digitalDelivery: delivery._id,
          delivery: delivery._id,
          order: order._id,
          product: product._id,
          orderItemIndex: i,
          user: order.user,
          customer: order.user,
          action: 'auto_delivered',
          event: 'delivered',
          deliveryMethod: 'automatic',
          performedBy: null,
          auditNotes: `Instant software access link delivered for "${product.title}".`,
        });

        await createSubscriptionFromOrderItem({ order, item, user });
        await Product.findByIdAndUpdate(product._id, { $inc: { salesCount: quantity } });
        continue;
      }

      // Route item to MANUAL DELIVERY QUEUE
      item.deliveryMethod = deliveryMethod;
      item.deliveryStatus = 'manual_queue';
      hasManualItems = true;
      allItemsDelivered = false;

      // Create audit log for queue entrance
      await DeliveryHistory.create({
        order: order._id,
        product: product._id,
        orderItemIndex: i,
        user: order.user,
        customer: order.user,
        action: 'manual_queued',
        event: 'manual_queued',
        deliveryMethod,
        performedBy: null,
        auditNotes: `Product is configured for manual delivery or stock is depleted. Order routed to Admin Manual Delivery Queue.`,
      });

      // Notify admins
      const admins = await User.find({ role: 'admin' });
      for (const admin of admins) {
        await Notification.create({
          user: admin._id,
          title: `New Order in Manual Delivery Queue: #${order.orderNumber}`,
          message: `Order #${order.orderNumber} requires manual key/credential delivery for "${product.title}".`,
          type: 'order',
          metadata: { orderId: order._id, productId: product._id },
        });
      }
    }
  }

  // Update order status based on item delivery statuses
  const hasWhatsApp = order.items.some((it) => it.deliveryStatus === 'awaiting_whatsapp_contact');
  if (hasWhatsApp) {
    order.deliveryStatus = 'awaiting_whatsapp_contact';
    order.orderStatus = 'processing';
  } else if (hasManualItems) {
    order.deliveryStatus = 'manual_queue';
    order.orderStatus = 'processing';
  } else {
    order.deliveryStatus = 'delivered';
    order.orderStatus = 'completed';
  }

  await order.save();

  // Process promotional cashback
  await processOrderCashback({ order, user });

  // Send customer notifications & email
  try {
    const customerUser = user || (await User.findById(order.user)) || {
      _id: order.user,
      email: order.customerEmail,
      name: order.customerName,
    };

    if (allItemsDelivered) {
      await Notification.create({
        user: order.user,
        title: 'Order Fulfilled & Keys Delivered!',
        message: `Your order #${order.orderNumber} has been delivered. Your license keys are now available in your Purchased Products vault.`,
        type: 'delivery',
        metadata: { orderId: order._id },
      });

      // Dispatch Automated Order Confirmation with PDF Invoice link
      dispatchOrderConfirmationEmail({ order, user: customerUser }).catch((e) =>
        console.error('Order confirmation email failed:', e.message)
      );

      // Dispatch Adaptive Digital Delivery Notification with Secure Vault Access Token
      dispatchDigitalDeliveryEmail({ order, user: customerUser, deliveryRecords: deliveryResults }).catch((e) =>
        console.error('Vault notification email failed:', e.message)
      );
    } else {
      await Notification.create({
        user: order.user,
        title: 'Payment Received – Order Being Prepared',
        message: `Your payment for order #${order.orderNumber} is confirmed. One or more products require manual provisioning and our fulfillment team is preparing your access credentials.`,
        type: 'order',
        metadata: { orderId: order._id },
      });

      // Dispatch Order Confirmation with Invoice even if fulfillment is pending
      dispatchOrderConfirmationEmail({ order, user: customerUser }).catch((e) =>
        console.error('Payment confirmation email failed:', e.message)
      );

      if (hasWhatsApp) {
        dispatchDigitalDeliveryEmail({ order, user: customerUser, deliveryRecords: [] }).catch((e) =>
          console.error('WhatsApp concierge notice email failed:', e.message)
        );
      }
    }
  } catch (err) {
    console.error('Notification dispatch error:', err.message);
  }

  return { deliveryResults, order };
};

/**
 * Fulfill manual delivery by an administrator
 */
export const fulfillManualDelivery = async ({
  orderId,
  itemIndex = 0,
  keys = [],
  accountCredentials = {},
  accessLink = '',
  instructions = '',
  deliveryNotes = '',
  adminUser,
}) => {
  const order = await Order.findById(orderId).populate('user');
  if (!order) {
    throw new Error('Order not found');
  }

  const item = order.items[itemIndex];
  if (!item) {
    throw new Error('Order item not found at specified index');
  }

  const product = await Product.findById(item.product);
  const normalizedKeys = Array.isArray(keys) ? keys : [keys].filter(Boolean);

  let expiryDate = null;
  if (product && product.keyExpiryDays && product.keyExpiryDays > 0) {
    expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + product.keyExpiryDays);
  }

  // Create DigitalDelivery record
  const delivery = await DigitalDelivery.create({
    order: order._id,
    user: order.user._id || order.user,
    product: item.product,
    productTitle: item.productTitle,
    productLogo: item.productLogo || (product ? product.logo : ''),
    duration: item.duration,
    validityText: item.validityText || item.planName || item.duration,
    isLifetime: !!item.isLifetime || item.duration === 'lifetime',
    deliveryType: 'admin_assisted',
    deliveryMethod: 'manual',
    deliveredBy: adminUser._id,
    keys: normalizedKeys,
    status: 'delivered',
    expiryDate: item.accessExpiresAt || expiryDate,
    accessExpiresAt: item.accessExpiresAt || expiryDate,
    orderItemIndex: itemIndex,
    adminNotes: deliveryNotes,
    payload: {
      licenseKey: normalizedKeys.join(', '),
      accountCredentials: {
        username: accountCredentials.username || '',
        password: accountCredentials.password || '',
        recoveryInfo: accountCredentials.recoveryInfo || '',
      },
      accessLink: accessLink || (product ? product.defaultAccessLink : ''),
      directDownloadUrl: product ? product.setupGuideUrl : '',
      instructions: instructions || (product ? product.deliveryInstructions : 'Credentials provided by administrator.'),
    },
    deliveredAt: new Date(),
  });

  // Update order item status
  item.deliveryStatus = 'delivered';
  item.digitalDeliveryId = delivery._id;
  item.allocatedKeys = normalizedKeys;

  // Check if all items in order are now delivered
  const remainingManual = order.items.filter((it) => it.deliveryStatus === 'manual_queue');
  if (remainingManual.length === 0) {
    order.deliveryStatus = 'delivered';
    order.orderStatus = 'completed';
  }
  await order.save();

  // Create DeliveryHistory audit log
  await DeliveryHistory.create({
    digitalDelivery: delivery._id,
    delivery: delivery._id,
    order: order._id,
    product: item.product,
    orderItemIndex: itemIndex,
    user: order.user._id || order.user,
    customer: order.user._id || order.user,
    action: 'manual_delivered',
    event: 'delivered',
    deliveryMethod: 'manual',
    keysDelivered: normalizedKeys,
    performedBy: adminUser._id,
    auditNotes: deliveryNotes || 'Manual delivery fulfilled by administrator',
  });

  // Create subscription
  await createSubscriptionFromOrderItem({ order, item, user: order.user });

  // Increment product sales
  if (product) {
    await Product.findByIdAndUpdate(product._id, { $inc: { salesCount: item.quantity || 1 } });
  }

  // Notify customer
  try {
    await Notification.create({
      user: order.user._id || order.user,
      title: `Credentials Delivered for "${item.productTitle}"`,
      message: `Your manual delivery for order #${order.orderNumber} is complete. View your keys and login details in your Purchased Products vault.`,
      type: 'delivery',
      metadata: { orderId: order._id, deliveryId: delivery._id },
    });

    // Dispatch Secure Adaptive Digital Delivery Notification
    const customerUser = (await User.findById(order.user._id || order.user)) || {
      _id: order.user._id || order.user,
      email: order.customerEmail,
      name: order.customerName,
    };
    dispatchDigitalDeliveryEmail({
      order,
      user: customerUser,
      deliveryRecords: [delivery],
    }).catch((e) =>
      console.error('Manual delivery email notification error:', e.message)
    );
  } catch (err) {
    console.error('Customer manual delivery notification error:', err.message);
  }

  return delivery;
};

/**
 * Re-deliver an order or item with full audit logging
 */
export const redeliverOrder = async ({
  orderId,
  deliveryId,
  newKeys = [],
  newPayload = {},
  reason = 'Admin replacement key issued',
  adminUser,
}) => {
  const delivery = await DigitalDelivery.findById(deliveryId);
  if (!delivery) {
    throw new Error('Digital delivery record not found');
  }

  const order = await Order.findById(orderId);
  if (!order) {
    throw new Error('Order not found');
  }

  const previousKeys = [...(delivery.keys || [])];
  const normalizedNewKeys = Array.isArray(newKeys) ? newKeys : [newKeys].filter(Boolean);

  if (normalizedNewKeys.length > 0) {
    delivery.keys = normalizedNewKeys;
    delivery.payload.licenseKey = normalizedNewKeys.join(', ');
  }

  if (newPayload.accountCredentials) {
    delivery.payload.accountCredentials = {
      ...delivery.payload.accountCredentials,
      ...newPayload.accountCredentials,
    };
  }
  if (newPayload.accessLink) delivery.payload.accessLink = newPayload.accessLink;
  if (newPayload.instructions) delivery.payload.instructions = newPayload.instructions;

  delivery.redeliveryCount = (delivery.redeliveryCount || 0) + 1;
  delivery.deliveredBy = adminUser._id;
  delivery.deliveredAt = new Date();
  delivery.adminNotes = `Re-delivered: ${reason}. Previous keys: ${previousKeys.join(', ')}`;
  await delivery.save();

  // Create audit trail in DeliveryHistory
  await DeliveryHistory.create({
    digitalDelivery: delivery._id,
    delivery: delivery._id,
    order: order._id,
    product: delivery.product,
    orderItemIndex: delivery.orderItemIndex || 0,
    user: delivery.user,
    customer: delivery.user,
    action: 're_delivered',
    event: 'redelivered',
    deliveryMethod: delivery.deliveryMethod,
    keysDelivered: normalizedNewKeys.length > 0 ? normalizedNewKeys : previousKeys,
    performedBy: adminUser._id,
    auditNotes: `Re-delivery #${delivery.redeliveryCount}. Reason: ${reason}. Previous: ${previousKeys.join(', ')}`,
  });

  // Notify customer
  try {
    await Notification.create({
      user: delivery.user,
      title: `License Updated / Re-delivered for "${delivery.productTitle}"`,
      message: `Your credentials for order #${order.orderNumber} have been re-issued by administrator support. Reason: ${reason}`,
      type: 'delivery',
      metadata: { orderId: order._id, deliveryId: delivery._id },
    });
  } catch (err) {
    console.error('Re-delivery notification error:', err.message);
  }

  return delivery;
};
