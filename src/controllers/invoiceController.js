import Invoice from '../models/Invoice.js';
import CreditNote from '../models/CreditNote.js';
import Order from '../models/Order.js';
import {
  getOrCreateInvoiceForOrder,
  getInvoicePdf,
  createCreditNoteForRefund,
  getBusinessInfoSnapshot,
} from '../services/invoiceService.js';
import { generateInvoicePdfBuffer } from '../services/invoicePdfGenerator.js';

/**
 * Customer: Get list of customer invoices
 */
export const getMyInvoices = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    const query = { user: req.user._id };

    const [invoices, total] = await Promise.all([
      Invoice.find(query)
        .populate('order', 'orderNumber orderStatus paymentStatus paymentMethod totalAmount currency createdAt')
        .sort({ invoiceDate: -1 })
        .skip(skip)
        .limit(limit),
      Invoice.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      invoices,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('Failed to get customer invoices:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Customer/Admin: Download or view invoice PDF
 */
export const downloadInvoicePdf = async (req, res) => {
  try {
    const { id } = req.params;
    const { filename, buffer, invoice } = await getInvoicePdf(id, req.user);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

    return res.send(buffer);
  } catch (err) {
    console.error('Invoice PDF download error:', err);
    return res.status(err.message.includes('authorized') ? 403 : 404).json({
      success: false,
      message: err.message,
    });
  }
};

/**
 * Customer/Admin: Get single invoice details by ID
 */
export const getInvoiceById = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate('order')
      .populate('creditNote');

    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    // Check authorization if not admin
    if (!['super_admin', 'admin', 'manager'].includes(req.user.role)) {
      if (invoice.user.toString() !== req.user._id.toString()) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
    }

    return res.status(200).json({ success: true, invoice });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Admin: Get all invoices with search, filters and pagination
 */
export const getAllInvoicesAdmin = async (req, res) => {
  try {
    const { search, status, dateFrom, dateTo, page = 1, limit = 20 } = req.query;
    const filter = {};

    if (status && status !== 'all') {
      filter.status = status;
    }

    if (dateFrom || dateTo) {
      filter.invoiceDate = {};
      if (dateFrom) filter.invoiceDate.$gte = new Date(dateFrom);
      if (dateTo) filter.invoiceDate.$lte = new Date(dateTo);
    }

    if (search) {
      filter.$or = [
        { invoiceNumber: new RegExp(search, 'i') },
        { customerName: new RegExp(search, 'i') },
        { customerEmail: new RegExp(search, 'i') },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [invoices, total, totalRevenueAgg] = await Promise.all([
      Invoice.find(filter)
        .populate('order', 'orderNumber paymentMethod')
        .sort({ invoiceDate: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Invoice.countDocuments(filter),
      Invoice.aggregate([
        { $match: filter },
        { $group: { _id: null, total: { $sum: '$financialSnapshot.totalAmount' } } },
      ]),
    ]);

    return res.status(200).json({
      success: true,
      invoices,
      stats: {
        totalInvoices: total,
        totalRevenue: totalRevenueAgg[0]?.total || 0,
      },
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err) {
    console.error('Failed to get admin invoices:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Admin: Generate invoice for order on demand
 */
export const generateInvoiceForOrderAdmin = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const invoice = await getOrCreateInvoiceForOrder(order);
    return res.status(200).json({
      success: true,
      message: `Invoice #${invoice.invoiceNumber} ready`,
      invoice,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Admin: Regenerate invoice business header details while preserving financial figures
 */
export const regenerateInvoiceAdmin = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    const businessInfo = await getBusinessInfoSnapshot();
    invoice.businessInfo = businessInfo;
    await invoice.save();

    return res.status(200).json({
      success: true,
      message: 'Invoice metadata updated successfully',
      invoice,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Admin: Issue a Credit Note for an Invoice
 */
export const issueCreditNoteAdmin = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id).populate('order');
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    if (invoice.creditNoteIssued) {
      return res.status(400).json({ success: false, message: 'A credit note has already been issued for this invoice' });
    }

    const { reason, refundAmount } = req.body;
    const creditNote = await createCreditNoteForRefund({
      order: invoice.order,
      refund: null,
      user: req.user,
      reason: reason || 'Administrative adjustment / refund',
    });

    return res.status(200).json({
      success: true,
      message: `Credit Note #${creditNote.creditNoteNumber} issued successfully`,
      creditNote,
      invoice,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
