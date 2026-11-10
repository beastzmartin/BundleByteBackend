import Subscription from '../models/Subscription.js';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import { calculateEndDate, checkAndUpdateSubscriptionStatuses } from '../services/subscriptionService.js';
import { getPaymentGateway } from '../services/payment/index.js';
import { logAudit } from '../middleware/audit.js';
import taxFeeEngine, { round2 } from '../services/taxFeeEngine.js';

export const getMySubscriptions = async (req, res, next) => {
  try {
    await checkAndUpdateSubscriptionStatuses();

    const subscriptions = await Subscription.find({ user: req.user._id })
      .populate('product', 'title slug logo pricing deliveryType')
      .populate('order', 'orderNumber paymentStatus')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: subscriptions.length,
      subscriptions,
    });
  } catch (error) {
    next(error);
  }
};

export const renewSubscription = async (req, res, next) => {
  try {
    const { subscriptionId, paymentMethod = 'mock' } = req.body;
    const subscription = await Subscription.findById(subscriptionId);

    if (!subscription) {
      return res.status(404).json({ success: false, message: 'Subscription not found' });
    }

    if (subscription.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized to renew this subscription' });
    }

    const product = await Product.findById(subscription.product);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Associated product no longer exists' });
    }

    const tier = product.pricing[subscription.duration];
    const unitPrice = tier?.price || subscription.billingCyclePrice;

    // Calculate GST via centralized tax engine
    const customerState = req.user.billingAddress?.state || 'Karnataka';
    const renewalItems = [
      {
        product: product._id,
        productTitle: product.title,
        productLogo: product.logo,
        productCategoryName: 'Subscription Renewal',
        duration: subscription.duration,
        unitPrice,
        quantity: 1,
        totalPrice: unitPrice,
        deliveryType: product.deliveryType,
        deliveryStatus: 'pending',
        hsnSac: product.hsnSacCode || '998434',
        taxRate: product.gstRate !== undefined && product.gstRate >= 0 ? product.gstRate : 18,
      },
    ];

    const orderTaxResult = await taxFeeEngine.calculateOrderTax({
      items: renewalItems,
      discount: 0,
      customerState,
    });

    const gatewayFeeResult = await taxFeeEngine.calculateGatewayFee({
      orderAmount: orderTaxResult.totalAmount,
      gatewayKey: paymentMethod,
    });

    const totalAmount = round2(orderTaxResult.totalAmount + gatewayFeeResult.customerSurcharge);

    // Create a renewal order
    const orderNumber = `BB-REN-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;

    const order = await Order.create({
      orderNumber,
      user: req.user._id,
      customerEmail: req.user.email,
      customerName: req.user.name,
      items: orderTaxResult.items,
      subtotal: orderTaxResult.subtotal,
      discount: 0,
      taxAmount: orderTaxResult.totalTax,
      totalAmount,
      taxDetails: {
        gstin: orderTaxResult.gstin,
        businessName: orderTaxResult.businessName,
        businessState: orderTaxResult.businessState,
        businessStateCode: orderTaxResult.businessStateCode,
        customerState: orderTaxResult.customerState,
        customerStateCode: orderTaxResult.customerStateCode,
        placeOfSupply: orderTaxResult.placeOfSupply,
        isIntraState: orderTaxResult.isIntraState,
        taxMode: orderTaxResult.taxMode,
        taxableAmount: orderTaxResult.taxableAmount,
        cgst: orderTaxResult.cgst,
        sgst: orderTaxResult.sgst,
        igst: orderTaxResult.igst,
        totalTax: orderTaxResult.totalTax,
        isExempt: false,
        hsnSacSummary: orderTaxResult.hsnSacSummary,
      },
      gatewayFeeDetails: {
        gatewayKey: gatewayFeeResult.gatewayKey,
        gatewayName: gatewayFeeResult.gatewayName,
        feePayer: gatewayFeeResult.feePayer,
        baseFee: gatewayFeeResult.baseFee,
        feeGst: gatewayFeeResult.feeGst,
        totalFee: gatewayFeeResult.totalFee,
        customerSurcharge: gatewayFeeResult.customerSurcharge,
      },
      currency: 'INR',
      baseCurrency: 'INR',
      baseAmount: totalAmount,
      customerCurrency: 'INR',
      customerAmount: totalAmount,
      paymentMethod,
      paymentStatus: 'pending',
      orderStatus: 'processing',
      deliveryStatus: 'pending',
      notes: `Renewal for subscription #${subscription._id}`,
    });

    const gateway = getPaymentGateway(paymentMethod);
    const paymentSession = await gateway.createPaymentSession({ order, user: req.user });

    res.status(201).json({
      success: true,
      message: 'Renewal order initiated',
      order,
      paymentSession,
    });
  } catch (error) {
    next(error);
  }
};

export const getAllSubscriptions = async (req, res, next) => {
  try {
    await checkAndUpdateSubscriptionStatuses();

    const { status, page = 1, limit = 20 } = req.query;
    const query = {};
    if (status && status !== 'all') query.status = status;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const skip = (pageNum - 1) * limitNum;

    const total = await Subscription.countDocuments(query);
    const subscriptions = await Subscription.find(query)
      .populate('user', 'name email')
      .populate('product', 'title slug')
      .populate('order', 'orderNumber')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    res.status(200).json({
      success: true,
      count: subscriptions.length,
      total,
      subscriptions,
    });
  } catch (error) {
    next(error);
  }
};

export const updateSubscriptionStatus = async (req, res, next) => {
  try {
    const { status, autoRenew, extendDays } = req.body;
    const subscription = await Subscription.findById(req.params.id);

    if (!subscription) {
      return res.status(404).json({ success: false, message: 'Subscription not found' });
    }

    if (status) subscription.status = status;
    if (autoRenew !== undefined) subscription.autoRenew = autoRenew;
    if (extendDays) {
      const currentEnd = new Date(subscription.endDate);
      currentEnd.setDate(currentEnd.getDate() + parseInt(extendDays, 10));
      subscription.endDate = currentEnd;
      if (subscription.status === 'expired' && currentEnd > new Date()) {
        subscription.status = 'active';
      }
    }

    await subscription.save();

    await logAudit({
      actor: req.user._id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: 'SUBSCRIPTION_UPDATED',
      entity: 'Subscription',
      entityId: subscription._id.toString(),
      details: { status, extendDays },
      req,
    });

    res.status(200).json({ success: true, subscription });
  } catch (error) {
    next(error);
  }
};

