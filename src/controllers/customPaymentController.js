import CustomPaymentMethod from '../models/CustomPaymentMethod.js';
import PaymentVerification from '../models/PaymentVerification.js';
import Order from '../models/Order.js';
import User from '../models/User.js';
import Payment from '../models/Payment.js';
import Notification from '../models/Notification.js';
import { creditWallet } from '../services/walletService.js';
import { processOrderKeyDelivery } from '../services/keyDeliveryEngine.js';

// Auto-seed default methods if database is empty
const ensureDefaultCustomMethods = async () => {
  const count = await CustomPaymentMethod.countDocuments();
  if (count === 0) {
    await CustomPaymentMethod.create([
      {
        name: 'Direct Bank Transfer (IMPS / NEFT / RTGS)',
        code: 'bank_transfer',
        category: 'bank_transfer',
        description: 'Transfer directly from your bank account to our corporate bank account with zero gateway fee.',
        instructions: '1. Transfer the exact amount via IMPS/NEFT to our verified account below.\n2. Note down the 12-digit UTR or Bank Reference number.\n3. Take a screenshot of the successful payment.\n4. Upload the screenshot and enter your UTR number below.',
        icon: 'Landmark',
        badgeText: '0% Surcharge',
        bankDetails: {
          accountHolderName: 'BundleByte Technologies Pvt Ltd',
          accountNumber: '921020045678912',
          bankName: 'HDFC Bank',
          ifscCode: 'HDFC0001234',
          branchName: 'Cyber City Branch, Bengaluru',
          swiftBic: 'HDFCINBB',
          customNotes: 'Please mention your Order ID in the transfer remarks/narration.',
        },
        verificationSettings: {
          requireTransactionId: true,
          transactionIdLabel: '12-Digit Bank UTR / Reference No.',
          transactionIdPlaceholder: 'e.g. 329012345678 or URN number',
          requireScreenshot: true,
          screenshotLabel: 'Bank Transfer Screenshot / Receipt',
          requireSenderName: true,
          senderNameLabel: 'Payer Account Holder Name',
          requireSenderBank: true,
        },
        currencies: ['INR', 'USD', 'ALL'],
        isActive: true,
        displayOrder: 1,
      },
      {
        name: 'Manual UPI QR / Scanner',
        code: 'manual_upi_qr',
        category: 'manual_qr',
        description: 'Scan our static merchant QR with Google Pay, PhonePe, Paytm, or CRED.',
        instructions: '1. Scan the merchant QR code with any UPI app on your phone.\n2. Pay the exact billing amount.\n3. Copy the 12-digit UPI Ref/UTR number.\n4. Attach receipt screenshot and submit for rapid approval.',
        icon: 'QrCode',
        badgeText: 'Instant Verification',
        qrCodeUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=upi%3A%2F%2Fpay%3Fpa%3Dbundlebyte%40icici%26pn%3DBundleByte%20Technologies',
        bankDetails: {
          accountHolderName: 'BundleByte Technologies',
          upiId: 'bundlebyte@icici',
          customNotes: 'Available 24x7 for all UPI apps.',
        },
        verificationSettings: {
          requireTransactionId: true,
          transactionIdLabel: '12-Digit UPI UTR Reference Number',
          transactionIdPlaceholder: 'e.g. 402198765432',
          requireScreenshot: true,
          screenshotLabel: 'Payment Confirmation Screenshot',
          requireSenderName: true,
          senderNameLabel: 'Your UPI Name / Phone',
        },
        currencies: ['INR', 'ALL'],
        isActive: true,
        displayOrder: 2,
      },
    ]);
  }
};

/**
 * GET /api/custom-payment-methods
 * Returns active custom payment methods for public checkout and wallet topup
 */
export const getActiveCustomMethods = async (req, res, next) => {
  try {
    await ensureDefaultCustomMethods();
    const methods = await CustomPaymentMethod.find({ isActive: true }).sort({ displayOrder: 1, createdAt: -1 });
    res.status(200).json({ success: true, methods });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/custom-payment-methods
 * Returns all custom payment methods (admin)
 */
export const getAllCustomMethods = async (req, res, next) => {
  try {
    await ensureDefaultCustomMethods();
    const methods = await CustomPaymentMethod.find().sort({ displayOrder: 1, createdAt: -1 });
    res.status(200).json({ success: true, methods });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/custom-payment-methods
 * Create custom payment method
 */
export const createCustomMethod = async (req, res, next) => {
  try {
    const { name, category, description, instructions, icon, badgeText, qrCodeUrl, bankDetails, verificationSettings, currencies, minAmount, maxAmount, isActive, displayOrder } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Payment method name is required' });
    }

    const code = req.body.code
      ? req.body.code.toLowerCase().replace(/[^a-z0-9_]/g, '_')
      : name.toLowerCase().replace(/[^a-z0-9_]/g, '_') + '_' + Date.now().toString().slice(-4);

    const existing = await CustomPaymentMethod.findOne({ code });
    if (existing) {
      return res.status(400).json({ success: false, message: `A payment method with code '${code}' already exists` });
    }

    const method = await CustomPaymentMethod.create({
      name: name.trim(),
      code,
      category: category || 'bank_transfer',
      description: description || '',
      instructions: instructions || '',
      icon: icon || 'CreditCard',
      badgeText: badgeText || 'Manual Payment',
      qrCodeUrl: qrCodeUrl || '',
      bankDetails: bankDetails || {},
      verificationSettings: verificationSettings || {
        requireTransactionId: true,
        transactionIdLabel: 'UTR / Transaction Reference',
        transactionIdPlaceholder: 'Enter transaction reference number',
        requireScreenshot: true,
        screenshotLabel: 'Upload Payment Screenshot',
        requireSenderName: true,
        senderNameLabel: 'Sender Account Holder Name',
      },
      currencies: currencies && currencies.length ? currencies : ['INR', 'USD', 'ALL'],
      minAmount: minAmount || 0,
      maxAmount: maxAmount || 0,
      isActive: isActive !== false,
      displayOrder: displayOrder || 0,
      createdBy: req.user?._id,
    });

    res.status(201).json({ success: true, message: 'Custom payment method created successfully', method });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/admin/custom-payment-methods/:id
 * Update custom payment method
 */
export const updateCustomMethod = async (req, res, next) => {
  try {
    const { id } = req.params;
    const method = await CustomPaymentMethod.findById(id);
    if (!method) {
      return res.status(404).json({ success: false, message: 'Custom payment method not found' });
    }

    const updatableFields = [
      'name',
      'category',
      'description',
      'instructions',
      'icon',
      'badgeText',
      'qrCodeUrl',
      'bankDetails',
      'verificationSettings',
      'currencies',
      'minAmount',
      'maxAmount',
      'isActive',
      'displayOrder',
    ];

    updatableFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        method[field] = req.body[field];
      }
    });

    method.updatedBy = req.user?._id;
    await method.save();

    res.status(200).json({ success: true, message: 'Payment method updated successfully', method });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/admin/custom-payment-methods/:id/toggle
 * Toggle active status
 */
export const toggleCustomMethod = async (req, res, next) => {
  try {
    const { id } = req.params;
    const method = await CustomPaymentMethod.findById(id);
    if (!method) {
      return res.status(404).json({ success: false, message: 'Custom payment method not found' });
    }

    method.isActive = !method.isActive;
    method.updatedBy = req.user?._id;
    await method.save();

    res.status(200).json({ success: true, message: `Payment method ${method.isActive ? 'activated' : 'deactivated'}`, method });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/admin/custom-payment-methods/:id
 * Delete custom payment method
 */
export const deleteCustomMethod = async (req, res, next) => {
  try {
    const { id } = req.params;
    const method = await CustomPaymentMethod.findByIdAndDelete(id);
    if (!method) {
      return res.status(404).json({ success: false, message: 'Custom payment method not found' });
    }

    res.status(200).json({ success: true, message: 'Payment method deleted successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/payments/upload-receipt
 * Upload payment screenshot or custom QR
 */
export const uploadPaymentFile = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const fileUrl = `/uploads/${req.query.type === 'qr' ? 'qrcodes' : 'receipts'}/${req.file.filename}`;
    res.status(200).json({
      success: true,
      fileUrl,
      fileName: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/payments/custom/submit
 * Customer submits manual verification details (Order payment or Wallet topup)
 */
export const submitCustomPayment = async (req, res, next) => {
  try {
    const {
      orderId,
      isWalletTopup,
      amount,
      currency = 'INR',
      methodId,
      methodCode,
      transactionId,
      screenshotUrl,
      senderName,
      senderAccount,
      senderBank,
      customerNotes,
      proofDetails = {},
    } = req.body;

    let method = null;
    if (methodId) {
      method = await CustomPaymentMethod.findById(methodId);
    } else if (methodCode) {
      method = await CustomPaymentMethod.findOne({ code: methodCode });
    }

    const cleanTxId = (transactionId || '').trim();
    if (method?.verificationSettings?.requireTransactionId && !cleanTxId) {
      return res.status(400).json({
        success: false,
        message: `${method.verificationSettings.transactionIdLabel || 'Transaction Reference ID'} is required`,
      });
    }

    if (method?.verificationSettings?.requireScreenshot && !screenshotUrl) {
      return res.status(400).json({
        success: false,
        message: 'Payment screenshot / receipt upload is required for verification',
      });
    }

    if (method?.verificationSettings?.requireSenderName && !(senderName || '').trim()) {
      return res.status(400).json({
        success: false,
        message: 'Sender / Account holder name is required',
      });
    }

    const refTx = cleanTxId || `MANUAL-${Date.now().toString().slice(-6)}`;
    const referenceCode = `REF-PAY-${Date.now().toString().slice(-6)}`;

    // Wallet Topup Flow
    if (isWalletTopup) {
      const topupAmount = parseFloat(amount);
      if (isNaN(topupAmount) || topupAmount <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid wallet topup amount' });
      }

      const paise = Math.round(topupAmount * 100);

      const verification = await PaymentVerification.create({
        order: null,
        user: req.user._id,
        paymentType: 'custom_payment',
        customMethod: method?._id || null,
        customMethodName: method?.name || 'Manual Payment',
        referenceCode,
        transactionId: refTx,
        amount: topupAmount,
        currency: currency.toUpperCase(),
        status: 'pending',
        screenshotUrl: screenshotUrl || '',
        senderName: (senderName || '').trim(),
        senderAccount: (senderAccount || '').trim(),
        senderBank: (senderBank || '').trim(),
        customerNotes: (customerNotes || '').trim(),
        proofDetails,
        isWalletTopup: true,
        walletAmountPaise: paise,
        adminNotes: `Submitted by customer for wallet topup of ${currency} ${topupAmount}. Pending manual review.`,
      });

      // Send admin notification
      await Notification.create({
        recipient: req.user._id,
        title: 'Wallet Top-Up Request Submitted',
        message: `Your deposit request of ₹${topupAmount.toFixed(2)} via ${method?.name || 'Manual Transfer'} has been received. Reference: ${refTx}. Our team will credit your wallet upon verification.`,
        type: 'wallet',
        metadata: { verificationId: verification._id, transactionId: refTx },
      }).catch(() => {});

      return res.status(200).json({
        success: true,
        pendingReview: true,
        verification,
        message: 'Payment details submitted successfully! Our billing desk will verify and credit your wallet shortly.',
      });
    }

    // Order Payment Flow
    if (!orderId) {
      return res.status(400).json({ success: false, message: 'Order ID is required' });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized for this order' });
    }

    if (order.paymentStatus === 'paid') {
      return res.status(200).json({
        success: true,
        message: 'Order is already marked as paid.',
        order,
      });
    }

    const verification = await PaymentVerification.create({
      order: order._id,
      user: req.user._id,
      paymentType: 'custom_payment',
      customMethod: method?._id || null,
      customMethodName: method?.name || 'Manual Payment',
      referenceCode,
      transactionId: refTx,
      amount: order.totalAmount,
      currency: order.currency || 'INR',
      status: 'pending',
      screenshotUrl: screenshotUrl || '',
      senderName: (senderName || '').trim(),
      senderAccount: (senderAccount || '').trim(),
      senderBank: (senderBank || '').trim(),
      customerNotes: (customerNotes || '').trim(),
      proofDetails,
      isWalletTopup: false,
      adminNotes: `Submitted by customer for Order #${order.orderNumber} via ${method?.name || 'Manual Transfer'}. Pending manual review.`,
    });

    order.paymentStatus = 'pending';
    order.paymentDetails = {
      transactionId: refTx,
      gateway: method?.code || 'manual_custom',
      screenshotUrl: screenshotUrl || '',
      submittedAt: new Date(),
      verificationId: verification._id,
    };
    await order.save();

    await Notification.create({
      recipient: req.user._id,
      title: `Payment Submitted for Order #${order.orderNumber}`,
      message: `Your payment reference ${refTx} has been recorded. Your license keys will be released instantly upon admin verification.`,
      type: 'order',
      metadata: { orderId: order._id, verificationId: verification._id },
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      pendingReview: true,
      verification,
      message: 'Payment details submitted successfully! Your order will be fulfilled as soon as verification completes.',
      order,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/payments/my-requests
 * Returns customer's payment verification requests
 */
export const getMyPaymentRequests = async (req, res, next) => {
  try {
    const requests = await PaymentVerification.find({ user: req.user._id })
      .populate('order', 'orderNumber totalAmount currency paymentStatus deliveryStatus')
      .populate('customMethod', 'name code category icon badgeText')
      .sort({ createdAt: -1 })
      .limit(50);

    res.status(200).json({ success: true, requests });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/payment-requests
 * Returns all payment verification requests for admin review
 */
export const getAdminPaymentRequests = async (req, res, next) => {
  try {
    const { status = 'all', type = 'all', search, page = 1, limit = 25 } = req.query;
    const query = {};

    if (status && status !== 'all') {
      query.status = status;
    }
    if (type && type !== 'all') {
      if (type === 'wallet') {
        query.isWalletTopup = true;
      } else if (type === 'order') {
        query.isWalletTopup = false;
      } else {
        query.paymentType = type;
      }
    }
    if (search && search.trim()) {
      const q = search.trim();
      query.$or = [
        { transactionId: { $regex: q, $options: 'i' } },
        { referenceCode: { $regex: q, $options: 'i' } },
        { senderName: { $regex: q, $options: 'i' } },
        { senderAccount: { $regex: q, $options: 'i' } },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 25);
    const skip = (pageNum - 1) * limitNum;

    const [requests, total, pendingCount, approvedTodayCount] = await Promise.all([
      PaymentVerification.find(query)
        .populate('order', 'orderNumber totalAmount currency customerName customerEmail items paymentStatus deliveryStatus')
        .populate('user', 'name email phone avatar')
        .populate('customMethod', 'name code category icon bankDetails')
        .populate('verifiedBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      PaymentVerification.countDocuments(query),
      PaymentVerification.countDocuments({ status: 'pending' }),
      PaymentVerification.countDocuments({
        status: 'approved',
        verifiedAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      }),
    ]);

    res.status(200).json({
      success: true,
      requests,
      stats: {
        total,
        pendingCount,
        approvedTodayCount,
      },
      meta: {
        total,
        page: pageNum,
        pages: Math.ceil(total / limitNum) || 1,
        limit: limitNum,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/payment-requests/:id/approve
 * Manually approve payment verification (Order or Wallet Topup)
 */
export const approvePaymentRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const verification = await PaymentVerification.findById(id).populate('order').populate('user');
    if (!verification) {
      return res.status(404).json({ success: false, message: 'Payment verification claim not found' });
    }

    if (verification.status === 'approved') {
      return res.status(400).json({ success: false, message: 'This transaction has already been approved' });
    }

    verification.status = 'approved';
    verification.verificationSource = 'admin_manual';
    verification.verifiedBy = req.user._id;
    verification.verifiedAt = new Date();
    if (notes) verification.adminNotes = notes;
    await verification.save();

    let deliveredResult = null;

    // Handle Order Fulfillment
    if (verification.order) {
      const order = await Order.findById(verification.order._id || verification.order);
      if (order) {
        order.paymentStatus = 'paid';
        order.paymentDetails = {
          ...order.paymentDetails,
          transactionId: verification.transactionId,
          gateway: verification.customMethodName || verification.paymentType,
          paidAt: new Date(),
        };
        await order.save();

        const customer = await User.findById(order.user);
        deliveredResult = await processOrderKeyDelivery(order, customer);

        await Notification.create({
          recipient: order.user,
          title: `Order #${order.orderNumber} Approved & Fulfilled!`,
          message: `Your payment reference ${verification.transactionId} has been verified! Digital delivery credentials and license keys are now active in your dashboard.`,
          type: 'order',
          metadata: { orderId: order._id },
        }).catch(() => {});
      }
    }

    // Handle Wallet Top-Up
    if (verification.isWalletTopup && verification.walletAmountPaise > 0) {
      await creditWallet({
        userId: verification.user._id || verification.user,
        amountPaise: verification.walletAmountPaise,
        type: 'topup',
        description: `Manual approval: ${verification.customMethodName || 'Manual Payment'} (Ref: ${verification.transactionId})`,
        metadata: {
          verificationId: verification._id,
          transactionId: verification.transactionId,
          paymentType: verification.paymentType,
        },
      });

      await Notification.create({
        recipient: verification.user._id || verification.user,
        title: 'Wallet Deposit Approved',
        message: `₹${(verification.walletAmountPaise / 100).toFixed(2)} has been credited to your store wallet. Reference: ${verification.transactionId}.`,
        type: 'wallet',
        metadata: { verificationId: verification._id },
      }).catch(() => {});
    }

    res.status(200).json({
      success: true,
      message: 'Payment verification approved successfully! Fulfillment executed.',
      verification,
      delivery: deliveredResult,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/payment-requests/:id/reject
 * Reject payment verification
 */
export const rejectPaymentRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason, notes } = req.body;

    const verification = await PaymentVerification.findById(id).populate('order').populate('user');
    if (!verification) {
      return res.status(404).json({ success: false, message: 'Payment verification claim not found' });
    }

    if (verification.status === 'approved') {
      return res.status(400).json({ success: false, message: 'Cannot reject an already approved payment' });
    }

    verification.status = 'rejected';
    verification.verifiedBy = req.user._id;
    verification.verifiedAt = new Date();
    verification.rejectionReason = reason || 'Payment could not be verified in banking records.';
    if (notes) verification.adminNotes = notes;
    await verification.save();

    // Notify customer
    const recipientId = verification.user?._id || verification.user;
    if (recipientId) {
      await Notification.create({
        recipient: recipientId,
        title: 'Payment Verification Unsuccessful',
        message: `Your payment reference ${verification.transactionId} could not be verified. Reason: ${verification.rejectionReason}. Please check your transaction details or contact support.`,
        type: verification.isWalletTopup ? 'wallet' : 'order',
        metadata: { verificationId: verification._id },
      }).catch(() => {});
    }

    res.status(200).json({
      success: true,
      message: 'Payment request rejected',
      verification,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/admin/payment-requests/:id
 * Edit payment request details (admin)
 */
export const updatePaymentRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { transactionId, senderName, senderAccount, senderBank, adminNotes, amount } = req.body;

    const verification = await PaymentVerification.findById(id);
    if (!verification) {
      return res.status(404).json({ success: false, message: 'Payment verification claim not found' });
    }

    if (transactionId !== undefined) verification.transactionId = transactionId.trim();
    if (senderName !== undefined) verification.senderName = senderName.trim();
    if (senderAccount !== undefined) verification.senderAccount = senderAccount.trim();
    if (senderBank !== undefined) verification.senderBank = senderBank.trim();
    if (adminNotes !== undefined) verification.adminNotes = adminNotes;
    if (amount !== undefined && !isNaN(parseFloat(amount))) {
      verification.amount = parseFloat(amount);
      if (verification.isWalletTopup) {
        verification.walletAmountPaise = Math.round(parseFloat(amount) * 100);
      }
    }

    await verification.save();

    res.status(200).json({
      success: true,
      message: 'Payment verification details updated successfully',
      verification,
    });
  } catch (error) {
    next(error);
  }
};

