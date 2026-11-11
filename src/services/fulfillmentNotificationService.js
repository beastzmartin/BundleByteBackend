import crypto from 'crypto';
import DeliveryNotification from '../models/DeliveryNotification.js';
import DigitalDelivery from '../models/DigitalDelivery.js';
import Order from '../models/Order.js';
import User from '../models/User.js';
import { ENV } from '../config/environment.js';
import { queueEmail } from './emailService.js';
import { getOrCreateInvoiceForOrder } from './invoiceService.js';
import { notifyOrderConfirmed, notifyDigitalDeliveryReady } from './pushNotificationService.js';

/**
 * Generates a short-lived cryptographically secure access token for customer vault retrieval
 */
export const generateSecureDeliveryToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * 1. Dispatches Order Confirmation Email with Invoice Download Link
 */
export const dispatchOrderConfirmationEmail = async ({ order, user }) => {
  try {
    const customerUser = user || (await User.findById(order.user));
    const invoice = await getOrCreateInvoiceForOrder(order, customerUser);

    const currencySymbol = order.currency === 'USD' ? '$' : '₹';
    const totalFormatted = `${currencySymbol}${Number(order.totalAmount || 0).toLocaleString('en-IN')}`;

    // Format HTML item list for email
    const itemsHtml = (order.items || [])
      .map(
        (it) => `
        <div style="padding: 10px 0; border-bottom: 1px solid #334155; display: flex; justify-content: space-between;">
          <div>
            <strong style="color: #ffffff;">${it.productTitle}</strong>
            <span style="display: block; font-size: 12px; color: #94a3b8;">Type: ${(it.deliveryType || '').replace(/_/g, ' ')} | Qty: ${it.quantity}</span>
          </div>
          <div style="text-align: right; color: #ffffff; font-weight: bold;">
            ${currencySymbol}${(it.totalPrice || it.unitPrice * it.quantity).toLocaleString('en-IN')}
          </div>
        </div>
      `
      )
      .join('');

    const invoiceUrl = `${ENV.CLIENT_URL}/dashboard/orders?invoice=${invoice._id}`;

    await queueEmail({
      recipient: order.customerEmail || customerUser?.email,
      recipientName: order.customerName || customerUser?.name || 'Valued Customer',
      templateKey: 'order_confirmation',
      category: 'order',
      order: order._id,
      invoice: invoice._id,
      subject: `Order #${order.orderNumber} Confirmed & Paid – Invoice Available`,
      variables: {
        orderNumber: order.orderNumber,
        orderTotal: totalFormatted,
        itemCount: order.items?.length || 1,
        paymentMethod: (order.paymentMethod || 'Online').toUpperCase(),
        invoiceNumber: invoice.invoiceNumber,
        invoiceUrl,
        itemsHtml,
        actionText: 'View Order & Download Invoice',
        actionUrl: `${ENV.CLIENT_URL}/dashboard/orders`,
      },
      metadata: {
        orderId: order._id.toString(),
        invoiceId: invoice._id.toString(),
        userId: order.user.toString(),
      },
    });

    // Real-time Push Notification & In-App Alert to customer and staff
    notifyOrderConfirmed({ order, user: customerUser }).catch((e) =>
      console.log('Order push notification error:', e.message)
    );

    return { success: true, invoiceId: invoice._id };
  } catch (err) {
    console.error('Failed to dispatch order confirmation email:', err);
    return { success: false, error: err.message };
  }
};

/**
 * 2. Dispatches Digital Product Delivery Email Adapting to Product Delivery Type
 */
export const dispatchDigitalDeliveryEmail = async ({ order, user, deliveryRecords = [] }) => {
  try {
    const customerUser = user || (await User.findById(order.user));
    const token = generateSecureDeliveryToken();
    const tokenExpiresAt = new Date();
    tokenExpiresAt.setHours(tokenExpiresAt.getHours() + 48); // Valid for 48 hours

    // Summarize items and determine dominant delivery type
    const items = order.items || [];
    let dominantType = 'instant_automated';
    let hasAccount = false;
    let hasLicense = false;
    let hasLink = false;
    let hasWhatsApp = false;

    const itemsSummary = items.map((it) => {
      if (it.deliveryType === 'account_credentials') hasAccount = true;
      if (it.deliveryType === 'license_key' || it.deliveryType === 'activation_code') hasLicense = true;
      if (it.deliveryType === 'access_link') hasLink = true;
      if (it.deliveryType === 'whatsapp_manual') hasWhatsApp = true;

      return {
        productTitle: it.productTitle,
        deliveryType: it.deliveryType,
        duration: it.duration,
        quantity: it.quantity,
        hasSensitiveCredentials: it.deliveryType === 'account_credentials' || it.deliveryType === 'license_key',
        setupGuideUrl: it.setupGuideUrl || '',
        accessLink: it.accessLink || '',
      };
    });

    if (hasAccount && !hasLicense) dominantType = 'account_credentials';
    else if (hasLicense && !hasAccount) dominantType = 'license_key';
    else if (hasLink && !hasAccount && !hasLicense) dominantType = 'access_link';
    else if (hasWhatsApp) dominantType = 'whatsapp_manual';
    else dominantType = 'multi_item';

    // Build specific adaptive HTML body
    let deliveryContentHtml = '';
    const secureVaultUrl = `${ENV.CLIENT_URL}/dashboard/vault?token=${token}`;

    if (dominantType === 'account_credentials') {
      deliveryContentHtml = `
        <h2 style="color: #ffffff; margin-top: 0;">Your Account Is Ready!</h2>
        <p>Your subscription account credentials for <strong>Order #${order.orderNumber}</strong> have been allocated and placed inside your personal encrypted vault.</p>
        <div style="background: #0f172a; padding: 18px; border-radius: 12px; margin: 20px 0; border: 1px solid #334155;">
          <p style="margin: 0 0 10px; color: #a5b4fc; font-weight: 600;">🔒 Secure Credentials Access</p>
          <p style="font-size: 13px; color: #94a3b8; margin: 0 0 16px;">
            For your security, account passwords are encrypted and never sent via unencrypted email. Click below to reveal your credentials in your authenticated Digital Vault.
          </p>
          <a href="${secureVaultUrl}" style="display: inline-block; background-color: #4f46e5; color: #ffffff; padding: 12px 24px; border-radius: 10px; font-weight: bold; text-decoration: none;">
            Reveal Account Credentials &rarr;
          </a>
        </div>
        <p style="font-size: 13px; color: #64748b;">This secure access link is valid for 48 hours. You can also view your credentials anytime by logging into your BundleByte account.</p>
      `;
    } else if (dominantType === 'license_key') {
      deliveryContentHtml = `
        <h2 style="color: #ffffff; margin-top: 0;">Your License Keys Are Ready!</h2>
        <p>Your digital license keys for <strong>Order #${order.orderNumber}</strong> are ready for immediate activation.</p>
        <div style="background: #0f172a; padding: 18px; border-radius: 12px; margin: 20px 0; border: 1px solid #334155;">
          <p style="margin: 0 0 10px; color: #a5b4fc; font-weight: 600;">🔑 License Key Details</p>
          <p style="font-size: 13px; color: #cbd5e1; margin: 0 0 12px;">
            Your keys, setup instructions, and official vendor download links are available in your Customer Vault.
          </p>
          <a href="${secureVaultUrl}" style="display: inline-block; background-color: #4f46e5; color: #ffffff; padding: 12px 24px; border-radius: 10px; font-weight: bold; text-decoration: none;">
            Access License Keys in Vault &rarr;
          </a>
        </div>
      `;
    } else if (dominantType === 'access_link') {
      deliveryContentHtml = `
        <h2 style="color: #ffffff; margin-top: 0;">Software Access Links Ready!</h2>
        <p>The software download and activation links for <strong>Order #${order.orderNumber}</strong> have been generated.</p>
        <div style="background: #0f172a; padding: 18px; border-radius: 12px; margin: 20px 0; border: 1px solid #334155;">
          <p style="margin: 0 0 10px; color: #a5b4fc; font-weight: 600;">📥 Direct Software Access</p>
          <p style="font-size: 13px; color: #cbd5e1; margin: 0 0 14px;">
            Click the link below to access your software setup guides and official download repository.
          </p>
          <a href="${secureVaultUrl}" style="display: inline-block; background-color: #4f46e5; color: #ffffff; padding: 12px 24px; border-radius: 10px; font-weight: bold; text-decoration: none;">
            Open Software Download Vault &rarr;
          </a>
        </div>
      `;
    } else if (dominantType === 'whatsapp_manual') {
      const whatsappUrl = `https://wa.me/919999999999?text=${encodeURIComponent(`Hi Support, I placed Order #${order.orderNumber} on BundleByte. Please assist with my delivery.`)}`;
      deliveryContentHtml = `
        <h2 style="color: #ffffff; margin-top: 0;">Payment Received – WhatsApp Delivery Required</h2>
        <p>Thank you for your payment on <strong>Order #${order.orderNumber}</strong>.</p>
        <div style="background: #0f172a; padding: 18px; border-radius: 12px; margin: 20px 0; border: 1px solid #334155;">
          <p style="margin: 0 0 10px; color: #38bdf8; font-weight: 600;">📱 Concierge WhatsApp Fulfillment</p>
          <p style="font-size: 13px; color: #cbd5e1; margin: 0 0 14px;">
            This product is fulfilled directly via WhatsApp concierge. Click below to message our support desk with your pre-filled order reference:
          </p>
          <a href="${whatsappUrl}" style="display: inline-block; background-color: #25d366; color: #ffffff; padding: 12px 24px; border-radius: 10px; font-weight: bold; text-decoration: none;">
            Contact Support on WhatsApp &rarr;
          </a>
        </div>
        <p style="font-size: 13px; color: #94a3b8;">Our typical concierge delivery turnaround is between 5 and 30 minutes during business hours.</p>
      `;
    } else {
      deliveryContentHtml = `
        <h2 style="color: #ffffff; margin-top: 0;">Your Purchased Digital Products Are Ready!</h2>
        <p>All items for <strong>Order #${order.orderNumber}</strong> are available in your Customer Vault.</p>
        <div style="background: #0f172a; padding: 18px; border-radius: 12px; margin: 20px 0; border: 1px solid #334155;">
          <a href="${secureVaultUrl}" style="display: inline-block; background-color: #4f46e5; color: #ffffff; padding: 12px 24px; border-radius: 10px; font-weight: bold; text-decoration: none;">
            Open Customer Digital Vault &rarr;
          </a>
        </div>
      `;
    }

    // Create DeliveryNotification tracking record
    const deliveryNotification = await DeliveryNotification.create({
      order: order._id,
      user: order.user,
      recipient: order.customerEmail || customerUser?.email,
      recipientName: order.customerName || customerUser?.name || 'Valued Customer',
      orderNumber: order.orderNumber,
      deliveryType: dominantType,
      itemsSummary,
      secureAccessToken: token,
      tokenExpiresAt,
      status: 'pending',
    });

    const emailRes = await queueEmail({
      recipient: order.customerEmail || customerUser?.email,
      recipientName: order.customerName || customerUser?.name || 'Valued Customer',
      templateKey: 'vault_delivery_ready',
      category: 'delivery',
      order: order._id,
      deliveryNotification: deliveryNotification._id,
      subject: `Your Digital Delivery for Order #${order.orderNumber} is Ready!`,
      htmlOverride: deliveryContentHtml,
      variables: {
        orderNumber: order.orderNumber,
        productTitle: items.map((it) => it.productTitle).join(', '),
        actionText: 'Access Your Vault',
        actionUrl: secureVaultUrl,
      },
      metadata: {
        orderId: order._id.toString(),
        notificationId: deliveryNotification._id.toString(),
      },
    });

    if (emailRes.success) {
      deliveryNotification.status = 'sent';
      deliveryNotification.emailLog = emailRes.logId;
      await deliveryNotification.save();
    }

    // Real-time Push Notification & Vault Access Alert to customer
    const mainTitle = items[0]?.productTitle || 'Digital License';
    notifyDigitalDeliveryReady({ order, user: customerUser, productTitle: mainTitle }).catch((e) =>
      console.log('Digital delivery push alert error:', e.message)
    );

    return { success: true, notificationId: deliveryNotification._id };
  } catch (err) {
    console.error('Failed to dispatch digital delivery email:', err);
    return { success: false, error: err.message };
  }
};

/**
 * 3. Safe resend of digital delivery notification (WITHOUT re-allocating keys or altering inventory)
 */
export const resendDeliveryNotification = async (notificationId, adminUser = null) => {
  const notification = await DeliveryNotification.findById(notificationId).populate('order');
  if (!notification) {
    throw new Error('Delivery notification record not found');
  }

  // Refresh token expiry to +48h
  const newToken = generateSecureDeliveryToken();
  const tokenExpiresAt = new Date();
  tokenExpiresAt.setHours(tokenExpiresAt.getHours() + 48);

  notification.secureAccessToken = newToken;
  notification.tokenExpiresAt = tokenExpiresAt;
  notification.resendCount += 1;
  notification.lastResentAt = new Date();
  if (adminUser) {
    notification.lastResentBy = adminUser._id;
  }
  await notification.save();

  const secureVaultUrl = `${ENV.CLIENT_URL}/dashboard/vault?token=${newToken}`;

  const emailRes = await queueEmail({
    recipient: notification.recipient,
    recipientName: notification.recipientName,
    templateKey: 'vault_delivery_ready',
    category: 'delivery',
    order: notification.order._id,
    deliveryNotification: notification._id,
    subject: `(Resent) Your Digital Delivery for Order #${notification.orderNumber} is Ready!`,
    variables: {
      orderNumber: notification.orderNumber,
      actionText: 'Access Your Digital Vault',
      actionUrl: secureVaultUrl,
    },
    metadata: {
      orderId: notification.order._id.toString(),
      resendCount: notification.resendCount,
    },
  });

  return { success: true, notification };
};
