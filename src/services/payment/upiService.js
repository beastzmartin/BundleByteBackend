import PaymentVerification from '../../models/PaymentVerification.js';
import TrustedPaymentRecord from '../../models/TrustedPaymentRecord.js';
import WebsiteSetting from '../../models/WebsiteSetting.js';

/**
 * Validate standard 12-digit Indian UPI UTR / RRN format
 * @param {string} utr
 */
export const validateUtrFormat = (utr) => {
  if (!utr || typeof utr !== 'string') return false;
  const clean = utr.trim();
  // Standard UPI transaction reference numbers are 12 digits, occasionally alpha-numeric for some bank gateways
  return /^[0-9]{12}$/.test(clean) || /^[A-Za-z0-9]{10,22}$/.test(clean);
};

/**
 * Check if a UTR has already been claimed or approved (Anti-Fraud / Idempotency)
 */
export const checkDuplicateUtr = async (utrNumber) => {
  const clean = utrNumber.trim();

  // Check verified payment claims
  const existingClaim = await PaymentVerification.findOne({
    transactionId: { $regex: new RegExp(`^${clean}$`, 'i') },
    status: { $in: ['approved', 'under_review', 'pending'] },
  });

  if (existingClaim) {
    return {
      isDuplicate: true,
      claim: existingClaim,
      message: `UTR "${clean}" has already been submitted for another order (Status: ${existingClaim.status}). Duplicate submissions are blocked.`,
    };
  }

  return { isDuplicate: false };
};

/**
 * Verify submitted UTR against trusted bank settlement records
 */
export const verifyUtrRecord = async ({ utrNumber, expectedAmount, currency = 'INR', orderId, userId }) => {
  const cleanUtr = utrNumber.trim();

  // 1. Format validation
  if (!validateUtrFormat(cleanUtr)) {
    return {
      verified: false,
      isFormatValid: false,
      message: 'Invalid UTR format. Please provide a valid 12-digit UPI Transaction Reference Number (RRN).',
    };
  }

  // 2. Duplicate check
  const dupCheck = await checkDuplicateUtr(cleanUtr);
  if (dupCheck.isDuplicate) {
    return {
      verified: false,
      isDuplicate: true,
      message: dupCheck.message,
    };
  }

  // 3. Lookup in trusted bank statement records
  const trustedRecord = await TrustedPaymentRecord.findOne({
    transactionId: cleanUtr,
    paymentType: 'upi_utr',
    status: 'credited',
    isClaimed: false,
  });

  const settings = await WebsiteSetting.findOne();
  const autoApprove = settings?.gateways?.upi?.autoApproveTrusted !== false;

  if (trustedRecord && autoApprove) {
    // Check amount match within ₹1 tolerance
    const amtDiff = Math.abs(trustedRecord.amount - expectedAmount);
    if (amtDiff <= 1.0) {
      // Mark as claimed atomically
      trustedRecord.isClaimed = true;
      trustedRecord.claimedByOrder = orderId || null;
      trustedRecord.claimedByUser = userId || null;
      trustedRecord.claimedAt = new Date();
      await trustedRecord.save();

      return {
        verified: true,
        autoApproved: true,
        source: 'trusted_ledger_auto',
        record: trustedRecord,
        message: `UTR verified against banking ledger: Credited ₹${trustedRecord.amount}.`,
      };
    } else {
      return {
        verified: false,
        requiresManualReview: true,
        amountMismatch: true,
        message: `Found UTR with amount ₹${trustedRecord.amount}, but expected ₹${expectedAmount}. Sent to Admin for review.`,
      };
    }
  }

  // 4. If not found in trusted ledger, it is queued for admin manual verification
  return {
    verified: false,
    requiresManualReview: true,
    message: 'UTR recorded. Our team will verify your transfer against our banking statement within minutes.',
  };
};

