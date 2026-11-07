import Payment from '../../models/Payment.js';
import crypto from 'crypto';

export const stripeGateway = {
  createPaymentSession: async ({ order, user }) => {
    const transactionId = `STRIPE-CS-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

    const payment = await Payment.create({
      order: order._id,
      user: user._id,
      amount: order.totalAmount,
      currency: order.currency,
      gateway: 'stripe',
      status: 'initiated',
      transactionId,
      gatewayReference: transactionId,
    });

    return {
      gateway: 'stripe',
      transactionId,
      paymentId: payment._id,
      checkoutUrl: `/checkout/simulate-payment?gateway=stripe&tx=${transactionId}&orderId=${order._id}`,
      amount: order.totalAmount,
      currency: order.currency,
    };
  },

  verifyPayment: async ({ transactionId, signature }) => {
    const payment = await Payment.findOne({ transactionId });
    if (!payment) {
      return { verified: false, message: 'Stripe transaction not found' };
    }

    if (payment.status === 'success') {
      return { verified: true, payment, alreadyProcessed: true };
    }

    payment.status = 'success';
    payment.webhookEvents.push({
      eventName: 'checkout.session.completed',
      receivedAt: new Date(),
      payload: { transactionId, signature: signature || 'verified-sig' },
    });
    await payment.save();

    return { verified: true, payment, alreadyProcessed: false };
  },

  processRefund: async ({ payment, amount, reason }) => {
    payment.status = 'refunded';
    payment.webhookEvents.push({
      eventName: 'charge.refunded',
      receivedAt: new Date(),
      payload: { amount, reason },
    });
    await payment.save();
    return { success: true, refundId: `re_${Date.now()}` };
  },
};

