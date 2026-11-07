import WhatsAppDelivery from '../models/WhatsAppDelivery.js';
import DigitalDelivery from '../models/DigitalDelivery.js';
import DeliveryHistory from '../models/DeliveryHistory.js';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import Notification from '../models/Notification.js';
import { dispatchDigitalDeliveryEmail } from './fulfillmentNotificationService.js';

/**
 * Format phone number for WhatsApp click-to-chat URL (removes spaces, +, -, parentheses)
 */
export const sanitizeWhatsAppPhone = (phone) => {
  if (!phone) return '919876543210';
  return phone.replace(/[^0-9]/g, '');
};

/**
 * Build safe pre-filled message from template
 * Never includes passwords, keys, or private card info
 */
export const buildWhatsAppMessage = ({ template, orderNumber, productTitle, paymentStatus = 'Paid' }) => {
  const defaultTemplate =
    'Hello! I have completed my purchase. Order ID: #{orderId} Product: {productTitle} Payment Status: {paymentStatus}. Please assist me with my product delivery. Thank you!';

  const tpl = template || defaultTemplate;
  return tpl
    .replace('{orderId}', orderNumber)
    .replace('#{orderId}', `#${orderNumber}`)
    .replace('{productTitle}', productTitle)
    .replace('{paymentStatus}', paymentStatus);
};

/**
 * Create a WhatsApp Delivery record and pre-filled click-to-chat link
 */
export const createWhatsAppDeliveryRecord = async ({ order, item, user, product }) => {
  const businessPhone =
    product.whatsappConfig?.businessPhone || process.env.WHATSAPP_BUSINESS_PHONE || '+91 98765 43210';
  const cleanPhone = sanitizeWhatsAppPhone(businessPhone);

  const prefilledMessage = buildWhatsAppMessage({
    template: product.whatsappConfig?.messageTemplate,
    orderNumber: order.orderNumber,
    productTitle: item.productTitle,
    paymentStatus: 'Paid',
  });

  const clickToChatUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(prefilledMessage)}`;

  const deliveryRecord = await WhatsAppDelivery.create({
    order: order._id,
    orderNumber: order.orderNumber,
    user: user._id || user,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    customerPhone: user.phone || '',
    product: product._id,
    productTitle: item.productTitle,
    duration: item.duration || 'annual',
    status: 'awaiting_whatsapp_contact',
    whatsappPhone: businessPhone,
    prefilledMessage,
    clickToChatUrl,
    internalNotes: 'Order paid. Waiting for customer to click WhatsApp contact button.',
  });

  return deliveryRecord;
};

/**
 * Fulfill WhatsApp Delivery by Administrator
 */
export const fulfillWhatsAppDelivery = async ({
  deliveryId,
  credentials = {},
  notes = '',
  adminUser,
}) => {
  const deliveryRecord = await WhatsAppDelivery.findById(deliveryId).populate('order').populate('product');
  if (!deliveryRecord) throw new Error('WhatsApp delivery record not found');

  const order = await Order.findById(deliveryRecord.order._id || deliveryRecord.order);
  if (!order) throw new Error('Associated order not found');

  deliveryRecord.status = 'delivered';
  deliveryRecord.deliveredBy = adminUser._id;
  deliveryRecord.deliveredAt = new Date();
  deliveryRecord.internalNotes = notes || 'Fulfilled via WhatsApp by admin concierge';
  deliveryRecord.deliveredCredentials = {
    username: credentials.username || '',
    password: credentials.password || '',
    licenseKey: credentials.licenseKey || '',
    instructions: credentials.instructions || 'Delivered via WhatsApp concierge.',
    accessLink: credentials.accessLink || '',
  };
  await deliveryRecord.save();

  // Create DigitalDelivery record so it appears in the customer vault
  const digitalDelivery = await DigitalDelivery.create({
    order: order._id,
    user: order.user,
    product: deliveryRecord.product._id || deliveryRecord.product,
    productTitle: deliveryRecord.productTitle,
    duration: deliveryRecord.duration,
    deliveryType: 'whatsapp_manual',
    deliveryMethod: 'whatsapp_manual',
    deliveredBy: adminUser._id,
    keys: credentials.licenseKey ? [credentials.licenseKey] : [],
    status: 'delivered',
    payload: {
      licenseKey: credentials.licenseKey || '',
      accountCredentials: {
        username: credentials.username || '',
        password: credentials.password || '',
        recoveryInfo: '',
      },
      accessLink: credentials.accessLink || '',
      instructions: credentials.instructions || 'Fulfillment confirmed via WhatsApp concierge.',
    },
    deliveredAt: new Date(),
    adminNotes: `WhatsApp Delivery completed by ${adminUser.name || adminUser.email}`,
  });

  // Update order item status
  const item = order.items.find(
    (it) => it.product.toString() === deliveryRecord.product.toString()
  );
  if (item) {
    item.deliveryStatus = 'delivered';
    item.digitalDeliveryId = digitalDelivery._id;
  }

  // If all items delivered, complete the order
  const allDelivered = order.items.every((it) => it.deliveryStatus === 'delivered');
  if (allDelivered) {
    order.deliveryStatus = 'delivered';
    order.orderStatus = 'completed';
  }
  await order.save();

  // Audit in DeliveryHistory
  await DeliveryHistory.create({
    digitalDelivery: digitalDelivery._id,
    order: order._id,
    product: deliveryRecord.product._id || deliveryRecord.product,
    user: order.user,
    customer: order.user,
    action: 'manual_delivered',
    event: 'delivered',
    deliveryMethod: 'whatsapp_manual',
    keysDelivered: credentials.licenseKey ? [credentials.licenseKey] : [],
    performedBy: adminUser._id,
    auditNotes: `WhatsApp concierge manual delivery completed. Delivered credentials: ${credentials.username || credentials.licenseKey || 'instructions'}`,
  });

  // Notify customer
  try {
    await Notification.create({
      user: order.user,
      title: `WhatsApp Delivery Completed for "${deliveryRecord.productTitle}"`,
      message: `Your order #${order.orderNumber} has been fulfilled. You can also view your delivered access credentials in your BundleByte vault.`,
      type: 'delivery',
      metadata: { orderId: order._id, deliveryId: digitalDelivery._id },
    });

    // Dispatch Adaptive Digital Delivery Notification to customer's email
    const customerUser = (await Order.findById(order._id).populate('user'))?.user;
    dispatchDigitalDeliveryEmail({
      order,
      user: customerUser,
      deliveryRecords: [digitalDelivery],
    }).catch((e) =>
      console.error('WhatsApp delivery completion email error:', e.message)
    );
  } catch (err) {
    console.error('Customer WhatsApp delivery notification error:', err.message);
  }

  return { deliveryRecord, digitalDelivery, order };
};

