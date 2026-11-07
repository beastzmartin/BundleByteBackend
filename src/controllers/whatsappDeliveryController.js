import WhatsAppDelivery from '../models/WhatsAppDelivery.js';
import Order from '../models/Order.js';
import { fulfillWhatsAppDelivery } from '../services/whatsappDeliveryService.js';

/**
 * GET /api/whatsapp-deliveries/order/:orderId
 * Retrieve WhatsApp delivery instructions and click-to-chat info for an order
 */
export const getOrderWhatsAppDelivery = async (req, res, next) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Permission check
    const isOwner = order.user.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Unauthorized to access this order' });
    }

    const deliveryRecord = await WhatsAppDelivery.findOne({ order: orderId })
      .populate('product', 'title slug logo whatsappConfig');

    if (!deliveryRecord) {
      return res.status(404).json({
        success: false,
        message: 'No WhatsApp delivery found for this order',
      });
    }

    // Customer safe output
    const safeData = deliveryRecord.toObject();
    if (!isAdmin) {
      delete safeData.internalNotes;
    }

    res.status(200).json({
      success: true,
      data: safeData,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/whatsapp-deliveries/order/:orderId/contacted
 * Record when customer clicks the WhatsApp button to contact support
 */
export const markCustomerContacted = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const deliveryRecord = await WhatsAppDelivery.findOne({ order: orderId });

    if (!deliveryRecord) {
      return res.status(404).json({ success: false, message: 'WhatsApp delivery not found' });
    }

    if (deliveryRecord.status === 'awaiting_whatsapp_contact') {
      deliveryRecord.status = 'customer_contacted';
      deliveryRecord.customerContactedAt = new Date();
      await deliveryRecord.save();
    }

    res.status(200).json({
      success: true,
      message: 'Contact timestamp recorded',
      status: deliveryRecord.status,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/admin/whatsapp-deliveries
 * Admin list of WhatsApp deliveries with filters and stats
 */
export const listWhatsAppDeliveries = async (req, res, next) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;

    const query = {};
    if (status && status !== 'all') {
      query.status = status;
    }

    if (search && search.trim()) {
      query.$or = [
        { orderNumber: { $regex: search.trim(), $options: 'i' } },
        { customerName: { $regex: search.trim(), $options: 'i' } },
        { customerEmail: { $regex: search.trim(), $options: 'i' } },
        { productTitle: { $regex: search.trim(), $options: 'i' } },
      ];
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const skip = (pageNum - 1) * limitNum;

    const [deliveries, total] = await Promise.all([
      WhatsAppDelivery.find(query)
        .populate('product', 'title slug logo category')
        .populate('user', 'name email phone')
        .populate('deliveredBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      WhatsAppDelivery.countDocuments(query),
    ]);

    // Summary counts
    const [awaitingCount, contactedCount, processingCount, deliveredCount] = await Promise.all([
      WhatsAppDelivery.countDocuments({ status: 'awaiting_whatsapp_contact' }),
      WhatsAppDelivery.countDocuments({ status: 'customer_contacted' }),
      WhatsAppDelivery.countDocuments({ status: 'processing' }),
      WhatsAppDelivery.countDocuments({ status: 'delivered' }),
    ]);

    res.status(200).json({
      success: true,
      data: deliveries,
      meta: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 1,
        stats: {
          total: awaitingCount + contactedCount + processingCount + deliveredCount,
          awaitingContact: awaitingCount,
          contacted: contactedCount,
          processing: processingCount,
          delivered: deliveredCount,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/admin/whatsapp-deliveries/:id/status
 * Update WhatsApp queue status & internal notes
 */
export const updateWhatsAppStatus = async (req, res, next) => {
  try {
    const { status, internalNotes } = req.body;
    const delivery = await WhatsAppDelivery.findById(req.params.id);

    if (!delivery) {
      return res.status(404).json({ success: false, message: 'WhatsApp delivery record not found' });
    }

    if (status) delivery.status = status;
    if (internalNotes !== undefined) delivery.internalNotes = internalNotes;

    await delivery.save();

    res.status(200).json({
      success: true,
      message: 'Status updated successfully',
      data: delivery,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/admin/whatsapp-deliveries/:id/fulfill
 * Admin fulfills WhatsApp order by recording delivered credentials/keys
 */
export const fulfillWhatsAppOrder = async (req, res, next) => {
  try {
    const { credentials = {}, notes = '' } = req.body;

    const result = await fulfillWhatsAppDelivery({
      deliveryId: req.params.id,
      credentials,
      notes,
      adminUser: req.user,
    });

    res.status(200).json({
      success: true,
      message: 'WhatsApp order delivered and customer vault updated successfully',
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

