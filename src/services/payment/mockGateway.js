/**
 * Mock Gateway - PERMANENTLY DISABLED IN PRODUCTION
 */
export const mockGateway = {
  createPaymentSession: async () => {
    throw new Error('Test payment gateway is disabled in production. Please use Binance, UPI, Stripe, or PayPal.');
  },
  verifyPayment: async () => {
    return {
      verified: false,
      message: 'Test payment gateway is disabled in production.',
    };
  },
  processRefund: async () => {
    throw new Error('Test payment gateway is disabled in production.');
  },
};
