import DigitalDelivery from '../models/DigitalDelivery.js';
import Order from '../models/Order.js';
import DeliveryHistory from '../models/DeliveryHistory.js';
import { fulfillManualDelivery, redeliverOrder } from '../services/keyDeliveryEngine.js';
import { logAudit } from '../middleware/audit.js';

/**
 * GET /api/deliveries/my-products
 * Dedicated customer purchased products vault
 */
export const getMyPurchasedProducts = async (req, res, next) => {
  try {
    const deliveries = await DigitalDelivery.find({ user: req.user._id })
      .populate('order', 'orderNumber paymentStatus createdAt paymentMethod')
      .populate('product', 'title slug logo deliveryType deliveryMethod deliveryInstructions activationProcess orderNote activationSteps setupGuideUrl keyVisibilitySettings category')
      .sort({ deliveredAt: -1 });

    const formatted = deliveries.map((d) => ({
      _id: d._id,
      orderId: d.order?._id,
      orderNumber: d.order?.orderNumber,
      orderDate: d.order?.createdAt,
      productTitle: d.productTitle,
      productLogo: d.productLogo || d.product?.logo,
      productId: d.product?._id,
      productSlug: d.product?.slug,
      duration: d.duration,
      deliveryMethod: d.deliveryMethod,
      keys: d.keys && d.keys.length > 0 ? d.keys : (d.payload?.licenseKey ? [d.payload.licenseKey] : []),
      primaryLicenseKey: d.keys?.[0] || d.payload?.licenseKey || '',
      accountCredentials: d.payload?.accountCredentials || { username: '', password: '', recoveryInfo: '' },
      accessLink: d.payload?.accessLink || '',
      directDownloadUrl: d.payload?.directDownloadUrl || '',
      instructions: d.payload?.activationProcess || d.product?.activationProcess || d.payload?.instructions || '',
      activationProcess: d.payload?.activationProcess || d.product?.activationProcess || d.payload?.instructions || '',
      orderNote: d.payload?.orderNote || d.product?.orderNote || d.adminNotes || '',
      activationSteps: d.product?.activationSteps || [],
      deliveredAt: d.deliveredAt,
      expiryDate: d.expiryDate,
      isExpired: d.expiryDate ? new Date() > new Date(d.expiryDate) : false,
      accessCount: d.accessCount,
      lastAccessedAt: d.lastAccessedAt,
      status: d.status,
      redeliveryCount: d.redeliveryCount || 0,
      payload: {
        licenseKey: d.keys?.[0] || d.payload?.licenseKey || '',
        accountCredentials: d.payload?.accountCredentials || { username: '', password: '', recoveryInfo: '' },
        accessLink: d.payload?.accessLink || '',
        directDownloadUrl: d.payload?.directDownloadUrl || '',
        instructions: d.payload?.activationProcess || d.product?.activationProcess || d.payload?.instructions || '',
        activationProcess: d.payload?.activationProcess || d.product?.activationProcess || d.payload?.instructions || '',
        orderNote: d.payload?.orderNote || d.product?.orderNote || d.adminNotes || '',
      },
      product: d.product || {
        _id: d.product?._id,
        title: d.productTitle,
        logo: d.productLogo,
        slug: d.product?.slug,
      },
    }));

    res.status(200).json({
      success: true,
      count: formatted.length,
      products: formatted,
      deliveries: formatted,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/deliveries/:orderId
 * Get delivery details for a specific order
 */
export const getDeliveryByOrderId = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized to view this order delivery' });
    }

    const deliveries = await DigitalDelivery.find({ order: order._id })
      .populate('product', 'title slug logo deliveryInstructions activationProcess orderNote activationSteps setupGuideUrl');

    // Update access counts
    for (const d of deliveries) {
      d.accessCount += 1;
      d.lastAccessedAt = new Date();
      await d.save();
    }

    res.status(200).json({
      success: true,
      order: {
        _id: order._id,
        orderNumber: order.orderNumber,
        deliveryStatus: order.deliveryStatus,
        paymentStatus: order.paymentStatus,
        items: order.items,
      },
      deliveries,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/deliveries/pending
 * Retrieve pending orders waiting in the MANUAL DELIVERY QUEUE
 */
export const getPendingManualQueue = async (req, res, next) => {
  try {
    const orders = await Order.find({
      $or: [
        { deliveryStatus: 'manual_queue' },
        { 'items.deliveryStatus': 'manual_queue' },
      ],
    })
      .populate('user', 'name email avatar')
      .populate('items.product', 'title logo slug defaultAccessLink deliveryInstructions deliveryMethod')
      .sort({ createdAt: 1 }); // oldest first

    // Flatten pending items for easy queue display
    const queueItems = [];
    orders.forEach((order) => {
      order.items.forEach((item, index) => {
        if (item.deliveryStatus === 'manual_queue') {
          queueItems.push({
            orderId: order._id,
            orderNumber: order.orderNumber,
            orderDate: order.createdAt,
            paymentStatus: order.paymentStatus,
            customer: order.user,
            itemIndex: index,
            itemId: item._id,
            productTitle: item.productTitle,
            productLogo: item.productLogo,
            duration: item.duration,
            quantity: item.quantity,
            totalPrice: item.totalPrice,
            productDetails: item.product,
          });
        }
      });
    });

    res.status(200).json({
      success: true,
      totalPendingOrders: orders.length,
      totalPendingItems: queueItems.length,
      queue: queueItems,
      orders,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/deliveries/:orderId/manual
 * Fulfill manual delivery for an order item
 */
export const fulfillManualOrderItem = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const {
      itemIndex = 0,
      keys = [],
      accountCredentials = {},
      accessLink = '',
      instructions = '',
      deliveryNotes = '',
    } = req.body;

    const delivery = await fulfillManualDelivery({
      orderId,
      itemIndex: parseInt(itemIndex, 10),
      keys,
      accountCredentials,
      accessLink,
      instructions,
      deliveryNotes,
      adminUser: req.user,
    });

    await logAudit({
      actor: req.user._id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: 'MANUAL_DELIVERY_FULFILLED',
      entity: 'Order',
      entityId: orderId,
      details: { itemIndex, deliveryId: delivery._id },
      req,
    });

    res.status(200).json({
      success: true,
      message: 'Product manually delivered to customer successfully!',
      delivery,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/deliveries/:orderId/redeliver
 * Re-deliver an order/item with updated keys/credentials and audit logging
 */
export const redeliverOrderItem = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { deliveryId, newKeys = [], newPayload = {}, reason = 'Admin replacement key issued' } = req.body;

    if (!deliveryId) {
      return res.status(400).json({ success: false, message: 'Delivery ID is required for re-delivery' });
    }

    const updatedDelivery = await redeliverOrder({
      orderId,
      deliveryId,
      newKeys,
      newPayload,
      reason,
      adminUser: req.user,
    });

    await logAudit({
      actor: req.user._id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: 'ORDER_REDELIVERED',
      entity: 'DigitalDelivery',
      entityId: deliveryId,
      details: { orderId, reason, redeliveryCount: updatedDelivery.redeliveryCount },
      req,
    });

    res.status(200).json({
      success: true,
      message: 'Product successfully re-delivered and audit logged.',
      delivery: updatedDelivery,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/deliveries/history
 * Complete delivery audit history
 */
export const getDeliveryAuditHistory = async (req, res, next) => {
  try {
    const { page = 1, limit = 25, event } = req.query;
    const query = {};

    if (event && event !== 'all') {
      query.event = event;
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const [history, total] = await Promise.all([
      DeliveryHistory.find(query)
        .populate('customer', 'name email')
        .populate('performedBy', 'name email')
        .populate('product', 'title logo')
        .populate('order', 'orderNumber')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      DeliveryHistory.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      history,
      pagination: {
        total,
        page: pageNum,
        pages: Math.ceil(total / limitNum),
        limit: limitNum,
      },
    });
  } catch (error) {
    next(error);
  }
};
