import PaytmMerchant from '../../models/PaytmMerchant.js';
import MerchantRoutingConfig from '../../models/MerchantRoutingConfig.js';

/**
 * Retrieve or initialize the singleton Merchant Routing Configuration
 */
export const getOrCreateRoutingConfig = async () => {
  let config = await MerchantRoutingConfig.findOne().populate('manualMerchant failoverOrder amountBrackets.merchant');
  if (!config) {
    config = await MerchantRoutingConfig.create({
      routingStrategy: 'round_robin',
      enableAutomaticFailover: true,
      amountBrackets: [],
      failoverOrder: [],
    });
  }
  return config;
};

/**
 * Reset daily volume for all merchants whose last reset date is before today
 */
export const refreshMerchantDailyVolumes = async (merchants) => {
  const now = new Date();
  for (const merchant of merchants) {
    const lastReset = merchant.dailyVolumeResetDate ? new Date(merchant.dailyVolumeResetDate) : new Date(0);
    const isSameDay =
      now.getUTCFullYear() === lastReset.getUTCFullYear() &&
      now.getUTCMonth() === lastReset.getUTCMonth() &&
      now.getUTCDate() === lastReset.getUTCDate();

    if (!isSameDay) {
      merchant.currentDailyVolume = 0;
      merchant.dailyVolumeResetDate = now;
      await merchant.save();
    }
  }
};

/**
 * Filter active merchants by transaction amount and daily limit constraints
 */
export const filterEligibleMerchants = (merchants, amount) => {
  return merchants.filter((m) => {
    if (m.status !== 'active' || m.isDeleted) return false;

    // Check min/max transaction amount
    if (amount < m.minAmount) return false;
    if (m.maxAmount > 0 && amount > m.maxAmount) return false;

    // Check daily volume capacity
    if (m.dailyLimit > 0 && m.currentDailyVolume + amount > m.dailyLimit) return false;

    return true;
  });
};

/**
 * Core Merchant Selection Engine implementing the 6 routing strategies
 *
 * @param {Object} options
 * @param {number} options.amount - Exact order amount in INR
 * @returns {Promise<PaytmMerchant>} Selected PaytmMerchant document
 */
export const selectMerchantForPayment = async ({ amount }) => {
  const allActiveMerchants = await PaytmMerchant.find({ isDeleted: false, status: 'active' });

  if (!allActiveMerchants || allActiveMerchants.length === 0) {
    throw new Error('No active Paytm merchant accounts are currently configured in the system.');
  }

  // Refresh any stale daily volumes for active merchants
  await refreshMerchantDailyVolumes(allActiveMerchants);

  // Filter eligible merchants based on amount & daily limit
  const eligibleMerchants = filterEligibleMerchants(allActiveMerchants, amount);

  if (eligibleMerchants.length === 0) {
    throw new Error(
      `No Paytm merchant accounts are eligible for this order amount (₹${amount.toFixed(
        2
      )}). All active accounts have either exceeded their daily transaction limit or cannot accept this amount.`
    );
  }

  const routingConfig = await getOrCreateRoutingConfig();
  const strategy = routingConfig.routingStrategy || 'round_robin';

  let selectedMerchant = null;

  switch (strategy) {
    case 'manual': {
      // Manual selection: use designated merchant if eligible
      if (routingConfig.manualMerchant) {
        const manualMatch = eligibleMerchants.find(
          (m) => m._id.toString() === routingConfig.manualMerchant._id.toString()
        );
        if (manualMatch) {
          selectedMerchant = manualMatch;
          break;
        }
      }
      // If manual merchant is ineligible or at capacity, fallback to priority
      selectedMerchant = selectByPriority(eligibleMerchants);
      break;
    }

    case 'priority': {
      selectedMerchant = selectByPriority(eligibleMerchants);
      break;
    }

    case 'least_used': {
      // Pick merchant with lowest current daily volume, then lowest total transactions
      const sorted = [...eligibleMerchants].sort((a, b) => {
        if (a.currentDailyVolume !== b.currentDailyVolume) {
          return a.currentDailyVolume - b.currentDailyVolume;
        }
        return a.totalTransactions - b.totalTransactions;
      });
      selectedMerchant = sorted[0];
      break;
    }

    case 'amount_based': {
      // Check configured amount brackets
      if (routingConfig.amountBrackets && routingConfig.amountBrackets.length > 0) {
        for (const bracket of routingConfig.amountBrackets) {
          if (amount >= bracket.min && amount <= bracket.max) {
            const bracketMatch = eligibleMerchants.find(
              (m) => m._id.toString() === bracket.merchant?._id?.toString() || m._id.toString() === bracket.merchant?.toString()
            );
            if (bracketMatch) {
              selectedMerchant = bracketMatch;
              break;
            }
          }
        }
      }
      // If no bracket matched or bracket merchant is ineligible, fallback to priority
      if (!selectedMerchant) {
        selectedMerchant = selectByPriority(eligibleMerchants);
      }
      break;
    }

    case 'failover': {
      // Check failover list in order
      if (routingConfig.failoverOrder && routingConfig.failoverOrder.length > 0) {
        for (const fMerchant of routingConfig.failoverOrder) {
          const match = eligibleMerchants.find(
            (m) => m._id.toString() === (fMerchant._id ? fMerchant._id.toString() : fMerchant.toString())
          );
          if (match) {
            selectedMerchant = match;
            break;
          }
        }
      }
      if (!selectedMerchant) {
        selectedMerchant = selectByPriority(eligibleMerchants);
      }
      break;
    }

    case 'round_robin':
    default: {
      // Round Robin across eligible merchants
      const currentIndex = routingConfig.roundRobinIndex % eligibleMerchants.length;
      selectedMerchant = eligibleMerchants[currentIndex];

      // Update round robin index atomically
      routingConfig.roundRobinIndex = (currentIndex + 1) % eligibleMerchants.length;
      await routingConfig.save();
      break;
    }
  }

  // Update selected merchant metadata
  selectedMerchant.totalTransactions += 1;
  selectedMerchant.lastUsedAt = new Date();
  await selectedMerchant.save();

  return selectedMerchant;
};

/**
 * Priority selection helper (1 is highest priority)
 */
function selectByPriority(merchants) {
  const sorted = [...merchants].sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    // Secondary sort: lower daily volume
    return a.currentDailyVolume - b.currentDailyVolume;
  });
  return sorted[0];
}

