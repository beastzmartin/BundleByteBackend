import Subscription from '../models/Subscription.js';

export const calculateEndDate = (duration, startDate = new Date()) => {
  const date = new Date(startDate);
  switch (duration) {
    case 'monthly':
      date.setDate(date.getDate() + 30);
      break;
    case 'quarterly':
      date.setDate(date.getDate() + 90);
      break;
    case 'half_yearly':
      date.setDate(date.getDate() + 180);
      break;
    case 'annual':
      date.setFullYear(date.getFullYear() + 1);
      break;
    case 'lifetime':
      date.setFullYear(date.getFullYear() + 100);
      break;
    default:
      date.setFullYear(date.getFullYear() + 1);
  }
  return date;
};

export const createSubscriptionFromOrderItem = async ({ order, item, user }) => {
  const isLifetime = item.duration === 'lifetime';
  const startDate = new Date();
  const endDate = calculateEndDate(item.duration, startDate);

  const subscription = await Subscription.create({
    user: user._id || user,
    product: item.product,
    productTitle: item.productTitle,
    productLogo: item.productLogo,
    order: order._id,
    duration: item.duration,
    billingCyclePrice: item.unitPrice,
    startDate,
    endDate,
    isLifetime,
    status: 'active',
    autoRenew: false,
  });

  return subscription;
};

export const checkAndUpdateSubscriptionStatuses = async () => {
  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Mark expired
  await Subscription.updateMany(
    { isLifetime: false, status: { $ne: 'expired' }, endDate: { $lt: now } },
    { $set: { status: 'expired' } }
  );

  // Mark expiring soon
  await Subscription.updateMany(
    { isLifetime: false, status: 'active', endDate: { $gte: now, $lte: sevenDaysFromNow } },
    { $set: { status: 'expiring_soon' } }
  );
};

