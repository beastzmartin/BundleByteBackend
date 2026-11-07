import Payment from '../../models/Payment.js';
import crypto from 'crypto';

export const paypalGateway = {
  createPaymentSession: async ({ order, user }) => {
    const transactionId = `PAYPAL-ORD-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    const payment = await Payment.create({
      order: order._id,
      user: user._id,
      amount: order.totalAmount,
      currency: order.currency,
      gateway: 'paypal',
      status: 'initiated',
      transactionId,
      gatewayReference: transactionId,
    });

    return {
      gateway: 'paypal',
      transactionId,
      paymentId: payment._id,
      checkoutUrl: `/checkout/simulate-payment?gateway=paypal&tx=${transactionId}&orderId=${order._id}`,
      amount: order.totalAmount,
      currency: order.currency,
    };
  },

  verifyPayment: async ({ transactionId }) => {
    const payment = await Payment.findOne({ transactionId });
    if (!payment) {
      return { verified: false, message: 'PayPal transaction not found' };
    }

    if (payment.status === 'success') {
      return { verified: true, payment, alreadyProcessed: true };
    }

    payment.status = 'success';
    payment.webhookEvents.push({
      eventName: 'PAYMENT.CAPTURE.COMPLETED',
      receivedAt: new Date(),
      payload: { transactionId },
    });
    await payment.save();

    return { verified: true, payment, alreadyProcessed: false };
  },

  processRefund: async ({ payment, amount, reason }) => {
    payment.status = 'refunded';
    payment.webhookEvents.push({
      eventName: 'PAYMENT.CAPTURE.REFUNDED',
      receivedAt: new Date(),
      payload: { amount, reason },
    });
    await payment.save();
    return { success: true, refundId: `PP-REF-${Date.now()}` };
  },
};

