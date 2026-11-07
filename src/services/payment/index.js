import crypto from 'crypto';
import { stripeGateway } from './stripeGateway.js';
import { paypalGateway } from './paypalGateway.js';
import { binanceGateway } from './binanceGateway.js';
import { upiGateway } from './upiGateway.js';
import { paytmGateway } from './paytmGateway.js';

export const walletGateway = {
  createPaymentSession: async ({ order, user, amount, currency, orderId }) => {
    return {
      gateway: 'wallet',
      transactionId: `WAL-SESS-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
      amount: order ? (order.baseAmount || order.totalAmount) : (amount || 0),
      currency: order ? (order.currency || 'INR') : (currency || 'INR'),
      status: 'pending',
    };
  },
  verifyPayment: async () => ({ verified: true }),
};

export const getPaymentGateway = (gatewayName = 'binance') => {
  const normalized = (gatewayName || '').toLowerCase();
  switch (normalized) {
    case 'wallet':
    case 'wallet_split':
      return walletGateway;
    case 'paytm':
    case 'paytm_qr':
      return paytmGateway;
    case 'binance':
    case 'binance_usdt':
    case 'crypto':
      return binanceGateway;
    case 'upi':
    case 'upi_utr':
      return upiGateway;
    case 'stripe':
      return stripeGateway;
    case 'paypal':
      return paypalGateway;
    case 'mock':
      throw new Error('Test payment system has been permanently disabled in production.');
    default:
      throw new Error(`Unsupported payment gateway: "${gatewayName}". Please select an active production gateway.`);
  }
};


