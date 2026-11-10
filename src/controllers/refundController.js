import Refund from '../models/Refund.js';
import Order from '../models/Order.js';
import DigitalDelivery from '../models/DigitalDelivery.js';
import Subscription from '../models/Subscription.js';
import Payment from '../models/Payment.js';
import User from '../models/User.js';
import { getPaymentGateway } from '../services/payment/index.js';
import { logAudit } from '../middleware/audit.js';
import { sendRefundNotificationEmail } from '../services/emailService.js';

export const requestRefund = async (req, res, next) => {
  try {
    const { orderId, reason } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    if (order.paymentStatus !== 'paid') {
      return res.status(400).json({ success: false, message: 'Only paid orders can be refunded' });
    }

    const existingRefund = await Refund.findOne({ order: order._id, status: { $in: ['requested', 'approved'] } });
    if (existingRefund) {
      return res.status(400).json({ success: false, message: 'A refund has already been requested for this order' });
    }

    const refund = await Refund.create({
      order: order._id,
      user: req.user._id,
      amount: order.totalAmount,
      reason,
      status: 'requested',
    });

    res.status(201).json({
      success: true,
      message: 'Refund request submitted for admin review',
      refund,
    });
  } catch (error) {
    next(error);
  }
};

export const getRefunds = async (req, res, next) => {
  try {
    const refunds = await Refund.find()
      .populate('user', 'name email')
      .populate('order', 'orderNumber totalAmount paymentMethod createdAt')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: refunds.length, refunds });
  } catch (error) {
    next(error);
  }
};

export const reviewRefund = async (req, res, next) => {
  try {
    const { status, adminNotes } = req.body;
    const refund = await Refund.findById(req.params.id);

    if (!refund) {
      return res.status(404).json({ success: false, message: 'Refund request not found' });
    }

    refund.status = status;
    refund.adminNotes = adminNotes || '';

    if (status === 'approved') {
      refund.processedAt = new Date();

      const order = await Order.findById(refund.order);
      if (order) {
        order.orderStatus = 'refunded';
        order.paymentStatus = 'refunded';
        await order.save();

        // Revoke deliveries and subscriptions
        await DigitalDelivery.updateMany({ order: order._id }, { $set: { status: 'revoked' } });
        await Subscription.updateMany({ order: order._id }, { $set: { status: 'cancelled' } });

        // Process refund on payment gateway
        const payment = await Payment.findOne({ order: order._id, status: 'success' });
        if (payment) {
          const gateway = getPaymentGateway(payment.gateway);
          await gateway.processRefund({ payment, amount: refund.amount, reason: refund.reason });
        }

        // Issue official GST Credit Note
        try {
          const { createCreditNoteForRefund } = await import('../services/invoiceService.js');
          const customerUser = await User.findById(refund.user);
          await createCreditNoteForRefund({ order, refund, user: customerUser, reason: refund.reason });
        } catch (cnErr) {
          console.error('Error generating GST credit note for refund:', cnErr);
        }
      }
    }

    await refund.save();

    // Send customer refund notification email
    const customerUser = await User.findById(refund.user);
    const orderDoc = await Order.findById(refund.order);
    if (customerUser && orderDoc) {
      sendRefundNotificationEmail(refund, orderDoc, customerUser).catch((err) =>
        console.error('Refund email dispatch error:', err.message)
      );
    }

    await logAudit({
      actor: req.user._id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: `REFUND_${status.toUpperCase()}`,
      entity: 'Refund',
      entityId: refund._id.toString(),
      details: { status, amount: refund.amount },
      req,
    });

    res.status(200).json({ success: true, message: `Refund ${status}`, refund });
  } catch (error) {
    next(error);
  }
};

