import crypto from 'crypto';
import DigitalDelivery from '../models/DigitalDelivery.js';
import LicenseInventory from '../models/LicenseInventory.js';
import Product from '../models/Product.js';
import Notification from '../models/Notification.js';
import { createSubscriptionFromOrderItem } from './subscriptionService.js';
import { sendMail } from '../config/mailer.js';
import { logAudit } from '../middleware/audit.js';

export const processOrderDigitalDelivery = async (order, user) => {
  const deliveryResults = [];

  for (let i = 0; i < order.items.length; i++) {
    const item = order.items[i];
    const product = await Product.findById(item.product);

    if (!product) continue;

    // 1. Try to find an unallocated key from LicenseInventory
    let inventoryRecord = await LicenseInventory.findOneAndUpdate(
      {
        product: product._id,
        isAllocated: false,
        $or: [{ durationType: item.duration }, { durationType: 'any' }],
      },
      {
        $set: {
          isAllocated: true,
          allocatedToOrder: order._id,
          allocatedToUser: order.user,
          allocatedAt: new Date(),
        },
      },
      { new: true }
    );

    let deliveredKey = '';
    let deliveredCredentials = { username: '', password: '', recoveryInfo: '' };
    let deliveredAccessLink = product.defaultAccessLink || '';

    if (inventoryRecord) {
      deliveredKey = inventoryRecord.licenseKey || '';
      deliveredCredentials = inventoryRecord.accountCredentials || deliveredCredentials;
      if (inventoryRecord.accessLink) {
        deliveredAccessLink = inventoryRecord.accessLink;
      }
    } else {
      // Auto-generate high-entropy digital activation code if pool was empty
      const randomChunk1 = crypto.randomBytes(3).toString('hex').toUpperCase();
      const randomChunk2 = crypto.randomBytes(3).toString('hex').toUpperCase();
      const prefix = product.title.replace(/[^A-Za-z0-9]/g, '').substring(0, 4).toUpperCase();
      deliveredKey = `BB-${prefix}-${randomChunk1}-${randomChunk2}`;

      if (!deliveredAccessLink) {
        deliveredAccessLink = `https://bundlebyte.com/activate?token=${crypto.randomBytes(16).toString('hex')}`;
      }
    }

    // 2. Create the DigitalDelivery record
    const delivery = await DigitalDelivery.create({
      order: order._id,
      user: order.user,
      product: product._id,
      productTitle: product.title,
      productLogo: product.logo,
      duration: item.duration,
      deliveryType: product.deliveryType,
      status: 'delivered',
      payload: {
        licenseKey: deliveredKey,
        accountCredentials: deliveredCredentials,
        accessLink: deliveredAccessLink,
        directDownloadUrl: product.setupGuideUrl || '',
        instructions: product.deliveryInstructions || 'Follow activation guidelines in your customer dashboard.',
      },
      deliveredAt: new Date(),
    });

    item.deliveryStatus = 'delivered';
    item.digitalDeliveryId = delivery._id;
    deliveryResults.push(delivery);

    // 3. Create active subscription
    await createSubscriptionFromOrderItem({ order, item, user });

    // 4. Increment product sales count
    await Product.findByIdAndUpdate(product._id, { $inc: { salesCount: 1 } });
  }

  // Update order delivery and status
  order.deliveryStatus = 'delivered';
  order.orderStatus = 'completed';
  await order.save();

  // 5. Create customer in-app notification
  await Notification.create({
    user: order.user,
    title: 'Order Fulfilled & Products Delivered!',
    message: `Your order #${order.orderNumber} has been delivered. Your license keys and credentials are now ready in your vault.`,
    type: 'delivery',
    link: '/dashboard/vault',
  });

  // 6. Send email with confirmation and delivery receipt
  const emailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b; background: #f8fafc; border-radius: 8px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #4f46e5; margin: 0; font-size: 26px;">BundleByte</h1>
        <p style="color: #64748b; font-size: 14px; margin-top: 4px;">Premium Digital Products & Subscriptions</p>
      </div>

      <div style="background: #ffffff; padding: 24px; border-radius: 8px; border: 1px solid #e2e8f0;">
        <h2 style="font-size: 18px; margin-top: 0; color: #0f172a;">Order Confirmed: #${order.orderNumber}</h2>
        <p style="color: #475569; font-size: 14px;">Thank you for your purchase, <strong>${order.customerName}</strong>! Your digital products have been verified and delivered to your secure vault.</p>

        <div style="margin: 20px 0; border-top: 1px solid #e2e8f0; padding-top: 16px;">
          <h3 style="font-size: 15px; margin: 0 0 12px 0;">Purchased Items:</h3>
          ${order.items
            .map(
              (it) => `
            <div style="margin-bottom: 12px; padding: 12px; background: #f1f5f9; border-radius: 6px;">
              <strong>${it.productTitle}</strong> (${it.duration})<br/>
              <span style="font-size: 13px; color: #64748b;">Amount: $${it.totalPrice.toFixed(2)}</span>
            </div>
          `
            )
            .join('')}
        </div>

        <div style="text-align: center; margin-top: 24px;">
          <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/dashboard/vault" 
             style="background: #4f46e5; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">
            Access Your Digital Products Vault
          </a>
        </div>
      </div>

      <p style="text-align: center; color: #94a3b8; font-size: 12px; margin-top: 24px;">
        &copy; ${new Date().getFullYear()} BundleByte Marketplace. All rights reserved.
      </p>
    </div>
  `;

  await sendMail({
    to: order.customerEmail,
    subject: `Order #${order.orderNumber} Fulfilled - Your Digital Products are Ready!`,
    html: emailHtml,
  });

  // 7. Audit log
  await logAudit({
    actor: user._id,
    actorEmail: user.email,
    actorRole: user.role,
    action: 'DIGITAL_DELIVERY_DISPATCHED',
    entity: 'Order',
    entityId: order._id.toString(),
    details: { orderNumber: order.orderNumber, itemsCount: order.items.length },
  });

  return deliveryResults;
};

