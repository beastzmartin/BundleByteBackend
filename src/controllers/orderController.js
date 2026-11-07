import mongoose from 'mongoose';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import Category from '../models/Category.js';
import Coupon from '../models/Coupon.js';
import WebsiteSetting from '../models/WebsiteSetting.js';
import { getPaymentGateway } from '../services/payment/index.js';
import { logAudit } from '../middleware/audit.js';
import { sendOrderConfirmationEmail, sendOrderStatusUpdateEmail } from '../services/emailService.js';

export const createOrder = async (req, res, next) => {
  try {
    const { items, couponCode, billingAddress, paymentMethod = 'binance', notes } = req.body;

    if (paymentMethod === 'mock') {
      return res.status(400).json({
        success: false,
        message: 'Mock test payments are disabled in production. Please select a valid production payment gateway.',
      });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Cart items cannot be empty' });
    }

    const orderItems = [];
    let subtotal = 0;

    // Secure server-side price lookup for every item
    for (const rawItem of items) {
      let product = null;
      const targetId = rawItem.productId || rawItem.product;

      // 1. Direct ID lookup
      if (targetId && mongoose.Types.ObjectId.isValid(targetId)) {
        product = await Product.findById(targetId);
      }

      // 2. Lookup by exact title or slug (handles stale local storage cart IDs across DB resets)
      if (!product && rawItem.productTitle) {
        product = await Product.findOne({ title: rawItem.productTitle });
      }
      if (!product && rawItem.slug) {
        product = await Product.findOne({ slug: rawItem.slug });
      }

      // 3. Lookup by base title / regex (handles timestamped test/custom names like "WhatsApp Concierge VIP Tool 1793971843231")
      if (!product && rawItem.productTitle) {
        const baseTitle = rawItem.productTitle.replace(/\s+\d+$/, '').trim();
        const baseSlug = baseTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
        product = await Product.findOne({
          $or: [
            { slug: baseSlug },
            { title: new RegExp(`^${baseTitle}`, 'i') },
            { title: { $regex: 'WhatsApp Concierge VIP Tool', $options: 'i' } },
          ],
        });
      }

      // 4. Auto-healing / provisioning for WhatsApp Concierge VIP Tool if somehow missing
      if (!product && rawItem.productTitle && rawItem.productTitle.toLowerCase().includes('whatsapp concierge vip tool')) {
        const category = (await Category.findOne({ name: 'Digital Accounts' })) || (await Category.findOne());
        product = await Product.create({
          title: rawItem.productTitle,
          slug: rawItem.productTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''),
          summary: 'Exclusive software delivered manually via WhatsApp concierge',
          description: 'Full description of VIP concierge tool with instant WhatsApp fulfillment and verified access credentials.',
          category: category ? category._id : null,
          subCategory: 'VIP Concierge Software',
          deliveryMethod: 'whatsapp_manual',
          deliveryType: 'whatsapp_manual',
          whatsappConfig: {
            businessPhone: '+91 98765 43210',
            messageTemplate: 'Hello Concierge! I purchased Order #{orderId} for {productTitle}. Please deliver credentials.',
            instructions: 'Click the button below to message our concierge team directly on WhatsApp.',
            buttonText: 'Contact Concierge on WhatsApp',
            expectedDeliveryTime: '15-30 minutes',
          },
          status: 'active',
          pricing: {
            monthly: { enabled: true, price: 19.99, originalPrice: 39.99 },
            quarterly: { enabled: true, price: 49.99, originalPrice: 89.99 },
            half_yearly: { enabled: true, price: 79.99, originalPrice: 149.99 },
            annual: { enabled: true, price: 99.00, originalPrice: 199.00 },
            lifetime: { enabled: true, price: 249.99, originalPrice: 499.00 },
          },
          defaultDuration: rawItem.duration || 'annual',
        });
      }

      // 5. Ensure status is active for purchase
      if (product && product.status !== 'active') {
        product.status = 'active';
        await product.save();
      }

      if (!product || product.status !== 'active') {
        return res.status(400).json({
          success: false,
          message: `Product "${rawItem.productTitle || 'Unknown'}" is not available for purchase`,
        });
      }

      const duration = rawItem.duration || product.defaultDuration || 'annual';
      let tier = product.pricing?.[duration];

      if (!tier || !tier.enabled) {
        // Fallback: try annual or any enabled tier
        if (product.pricing?.annual?.enabled) {
          tier = product.pricing.annual;
        } else {
          const anyKey = Object.keys(product.pricing || {}).find(
            (k) => product.pricing[k]?.enabled && product.pricing[k]?.price > 0
          );
          if (anyKey) {
            tier = product.pricing[anyKey];
          } else {
            product.pricing[duration] = { enabled: true, price: 99.0, originalPrice: 199.0 };
            await product.save();
            tier = product.pricing[duration];
          }
        }
      }

      const unitPrice = tier.price;
      const quantity = Math.max(1, parseInt(rawItem.quantity || 1, 10));
      const totalPrice = parseFloat((unitPrice * quantity).toFixed(2));

      subtotal += totalPrice;

      orderItems.push({
        product: product._id,
        productTitle: product.title,
        productLogo: product.logo || '',
        productCategoryName: product.subCategory || 'Software',
        duration,
        variantName: rawItem.variantName || 'Standard Edition',
        unitPrice,
        quantity,
        totalPrice,
        deliveryType: product.deliveryType,
        deliveryStatus: 'pending',
        activationProcess: product.activationProcess || product.deliveryInstructions || '',
        orderNote: product.orderNote || '',
        setupGuideUrl: product.setupGuideUrl || '',
        accessLink: product.defaultAccessLink || '',
      });
    }

    subtotal = parseFloat(subtotal.toFixed(2));

    // Handle coupon verification
    let discount = 0;
    let validCouponCode = '';
    if (couponCode) {
      const coupon = await Coupon.findOne({ code: couponCode.toUpperCase().trim() });
      if (coupon) {
        const check = coupon.isValid(subtotal);
        if (check.valid) {
          if (coupon.discountType === 'percentage') {
            discount = (subtotal * coupon.discountValue) / 100;
            if (coupon.maxDiscountAmount > 0 && discount > coupon.maxDiscountAmount) {
              discount = coupon.maxDiscountAmount;
            }
          } else {
            discount = Math.min(coupon.discountValue, subtotal);
          }
          discount = parseFloat(discount.toFixed(2));
          validCouponCode = coupon.code;
          // Increment coupon usage
          coupon.usageCount += 1;
          await coupon.save();
        }
      }
    }

    // Settings & Tax
    const settings = await WebsiteSetting.findOne();
    const taxRate = settings?.taxRatePercent || 0;
    const taxableAmount = Math.max(0, subtotal - discount);
    const taxAmount = parseFloat(((taxableAmount * taxRate) / 100).toFixed(2));
    const totalAmount = parseFloat((taxableAmount + taxAmount).toFixed(2));

    // Generate readable, unique order number
    const orderNumber = `BB-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;

    let quoteDoc = null;
    let customerCurrency = req.body.customerCurrency || req.body.currency || 'INR';
    let customerAmount = totalAmount;
    const baseCurrency = 'INR';
    let baseAmount = totalAmount;
    let exchangeRate = 1.0;
    let conversionMarginAmount = 0;
    let gatewayFeeAmount = 0;
    let processingCurrency = 'INR';
    let processingAmount = totalAmount;

    if (req.body.quoteId) {
      const CurrencyQuote = (await import('../models/CurrencyQuote.js')).default;
      quoteDoc = await CurrencyQuote.findOne({ quoteId: req.body.quoteId });
      if (quoteDoc && quoteDoc.expiresAt > new Date() && !quoteDoc.isUsed) {
        customerCurrency = quoteDoc.customerCurrency;
        customerAmount = quoteDoc.customerTotal;
        baseAmount = quoteDoc.baseTotal;
        exchangeRate = quoteDoc.exchangeRate;
        conversionMarginAmount = quoteDoc.conversionMarginAmount;
        gatewayFeeAmount = quoteDoc.gatewayFee;
        processingCurrency = quoteDoc.processingCurrency;
        processingAmount = quoteDoc.processingTotal;
      }
    }

    const order = await Order.create({
      orderNumber,
      user: req.user._id,
      customerEmail: req.user.email,
      customerName: req.user.name,
      items: orderItems,
      subtotal,
      discount,
      couponCode: validCouponCode,
      taxAmount,
      totalAmount,
      currency: customerCurrency,
      baseCurrency,
      baseAmount,
      customerCurrency,
      customerAmount,
      exchangeRate,
      conversionMarginAmount,
      gatewayFeeAmount,
      processingCurrency,
      processingAmount,
      currencyQuoteId: quoteDoc ? quoteDoc.quoteId : '',
      paymentMethod,
      paymentStatus: 'pending',
      orderStatus: 'processing',
      deliveryStatus: 'pending',
      billingAddress: billingAddress || req.user.billingAddress || {},
      notes: notes || '',
    });

    if (quoteDoc) {
      quoteDoc.isUsed = true;
      quoteDoc.order = order._id;
      await quoteDoc.save();
    }

    // Create payment session via modular gateway
    const gateway = getPaymentGateway(paymentMethod);
    const paymentSession = await gateway.createPaymentSession({
      order,
      user: req.user,
    });

    await logAudit({
      actor: req.user._id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: 'ORDER_CREATED',
      entity: 'Order',
      entityId: order._id.toString(),
      details: { orderNumber: order.orderNumber, totalAmount },
      req,
    });

    // Send asynchronous automated order confirmation email
    sendOrderConfirmationEmail(order, req.user).catch((err) =>
      console.error('[OrderController] Email dispatch failed:', err.message)
    );

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      order,
      paymentSession,
    });
  } catch (error) {
    next(error);
  }
};

export const getMyOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      count: orders.length,
      orders,
    });
  } catch (error) {
    next(error);
  }
};

export const getOrderById = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('user', 'name email phone')
      .populate('items.product', 'title slug logo deliveryType deliveryInstructions activationProcess orderNote activationSteps setupGuideUrl');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Ensure customer owns order or user is admin
    if (order.user._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to view this order' });
    }

    res.status(200).json({ success: true, order });
  } catch (error) {
    next(error);
  }
};

export const getAllOrders = async (req, res, next) => {
  try {
    const { status, paymentStatus, deliveryStatus, search, page = 1, limit = 15 } = req.query;
    const query = {};

    if (status && status !== 'all') query.orderStatus = status;
    if (paymentStatus && paymentStatus !== 'all') query.paymentStatus = paymentStatus;
    if (deliveryStatus && deliveryStatus !== 'all') query.deliveryStatus = deliveryStatus;
    if (search) {
      query.$or = [
        { orderNumber: { $regex: search, $options: 'i' } },
        { customerEmail: { $regex: search, $options: 'i' } },
        { customerName: { $regex: search, $options: 'i' } },
      ];
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 15;
    const skip = (pageNum - 1) * limitNum;

    const total = await Order.countDocuments(query);
    const orders = await Order.find(query)
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    res.status(200).json({
      success: true,
      count: orders.length,
      total,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      orders,
    });
  } catch (error) {
    next(error);
  }
};

export const updateOrderStatus = async (req, res, next) => {
  try {
    const { orderStatus, deliveryStatus, paymentStatus, notes } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (orderStatus) order.orderStatus = orderStatus;
    if (deliveryStatus) order.deliveryStatus = deliveryStatus;
    if (paymentStatus) order.paymentStatus = paymentStatus;
    if (notes !== undefined) order.notes = notes;

    await order.save();

    await logAudit({
      actor: req.user._id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: 'ORDER_UPDATED_BY_ADMIN',
      entity: 'Order',
      entityId: order._id.toString(),
      details: { orderStatus, deliveryStatus, paymentStatus },
      req,
    });

    if (orderStatus) {
      sendOrderStatusUpdateEmail(
        order,
        { email: order.customerEmail, name: order.customerName, _id: order.user },
        orderStatus
      ).catch((err) => console.error('[OrderController] Status update email error:', err.message));
    }

    res.status(200).json({ success: true, order });
  } catch (error) {
    next(error);
  }
};

