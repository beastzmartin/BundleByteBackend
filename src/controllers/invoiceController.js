import Invoice from '../models/Invoice.js';
import CreditNote from '../models/CreditNote.js';
import Order from '../models/Order.js';
import WebsiteSetting from '../models/WebsiteSetting.js';
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

/**
 * Customer / Public / Admin: Get current Invoice Designer settings
 */
export const getInvoiceDesignerSettings = async (req, res) => {
  try {
    const settings = await WebsiteSetting.findOne().select('invoiceConfig');
    const invoiceConfig = settings?.invoiceConfig || {
      companyName: 'BundleByte Technologies Pvt Ltd',
      businessAddress: '100 Innovation Boulevard, Tech Park, Bangalore 560001',
      supportEmail: 'billing@bundlebyte.com',
      supportPhone: '+91 80 4000 1234',
      gstin: '29ABCDE1234F1Z5',
      websiteUrl: 'https://bundlebyte.com',
      invoiceTitle: 'TAX INVOICE',
      invoicePrefix: 'INV',
      accentColor: '#4f46e5',
      secondaryColor: '#0f172a',
      logoUrl: '',
      showLogo: true,
      showAccessLinks: true,
      accessButtonLabel: 'Access Product & Vault',
      showLicenseKeyPreview: true,
      showHsnSac: true,
      showGstBreakdown: true,
      defaultPlaceOfSupply: 'Karnataka (29)',
      termsText:
        '1. Genuine perpetual licenses and account credentials reside in your encrypted customer vault.\n2. Sale is subject to standard terms of service & 14-day replacement warranty.\n3. This is a computer-generated tax invoice and requires no physical signature.',
      footerNote:
        'Official tax receipt for verified digital software licenses. Registered in accordance with online merchant standards.',
    };

    return res.status(200).json({
      success: true,
      invoiceConfig,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Admin: Update Invoice Designer settings
 */
export const updateInvoiceDesignerSettings = async (req, res) => {
  try {
    const newConfig = req.body;
    let settings = await WebsiteSetting.findOne();
    if (!settings) {
      settings = new WebsiteSetting();
    }

    settings.invoiceConfig = {
      ...(settings.invoiceConfig ? settings.invoiceConfig.toObject() : {}),
      ...newConfig,
    };

    await settings.save();

    return res.status(200).json({
      success: true,
      message: 'Invoice Designer settings saved successfully',
      invoiceConfig: settings.invoiceConfig,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Admin: Generate a Test / Preview Invoice PDF with current draft settings
 */
export const generateTestInvoicePdf = async (req, res) => {
  try {
    const draftConfig = req.body.invoiceConfig || {};
    const mockOrderType = req.body.mockType || 'single';

    // Build realistic mock invoice
    const mockItems = mockOrderType === 'multi'
      ? [
          {
            productTitle: 'JetBrains All Products Pack (1-Year Commercial)',
            duration: 'annual',
            quantity: 1,
            unitPrice: 24999,
            totalPrice: 24999,
            hsnSac: '998434',
            productAccessLink: 'https://bundlebyte.com/dashboard/vault',
            setupGuideUrl: 'https://bundlebyte.com/docs/jetbrains-setup',
            vaultUrl: 'https://bundlebyte.com/dashboard/vault',
            licenseKey: 'JB-2026-X99B-4812-PRO',
          },
          {
            productTitle: 'Claude Pro Corporate Multi-Seat License',
            duration: 'monthly',
            quantity: 2,
            unitPrice: 1999,
            totalPrice: 3998,
            hsnSac: '998434',
            productAccessLink: 'https://bundlebyte.com/dashboard/vault',
            setupGuideUrl: 'https://bundlebyte.com/docs/claude-onboarding',
            vaultUrl: 'https://bundlebyte.com/dashboard/vault',
            licenseKey: '',
          },
        ]
      : [
          {
            productTitle: 'Microsoft Windows 11 Pro Retail License (Perpetual)',
            duration: 'lifetime',
            quantity: 1,
            unitPrice: 4999,
            totalPrice: 4999,
            hsnSac: '998434',
            productAccessLink: 'https://bundlebyte.com/dashboard/vault',
            setupGuideUrl: 'https://bundlebyte.com/docs/win11-activate',
            vaultUrl: 'https://bundlebyte.com/dashboard/vault',
            licenseKey: 'W11PR-99B4-4812-ABCD-7777',
          },
        ];

    const subtotal = mockItems.reduce((acc, it) => acc + it.totalPrice, 0);
    const taxAmount = Math.round(subtotal * 0.18);
    const totalAmount = subtotal + taxAmount;

    const mockInvoice = {
      invoiceNumber: `${draftConfig.invoicePrefix || 'INV'}-2026-PREVIEW`,
      order: {
        orderNumber: 'ORD-TEST-9921',
      },
      customerName: req.user?.name || 'Admin Tester',
      customerEmail: req.user?.email || 'admin@bundlebyte.com',
      invoiceDate: new Date(),
      status: 'paid',
      paymentDetails: {
        paymentStatus: 'paid',
        paymentMethod: 'UPI_INSTANT',
        transactionId: 'TXN-TEST-PREVIEW-8812',
      },
      businessInfo: {
        companyName: draftConfig.companyName || 'BundleByte Technologies Pvt Ltd',
        businessAddress: draftConfig.businessAddress || '100 Innovation Boulevard, Tech Park, Bangalore 560001',
        emailAddress: draftConfig.supportEmail || 'billing@bundlebyte.com',
        contactPhone: draftConfig.supportPhone || '+91 80 4000 1234',
        gstin: draftConfig.gstin || '29ABCDE1234F1Z5',
        websiteUrl: draftConfig.websiteUrl || 'https://bundlebyte.com',
      },
      items: mockItems,
      financialSnapshot: {
        subtotal,
        discount: 0,
        taxableAmount: subtotal,
        taxAmount,
        currency: 'INR',
        isIntraState: true,
        taxBreakdown: {
          cgst: taxAmount / 2,
          sgst: taxAmount / 2,
          igst: 0,
        },
        placeOfSupply: draftConfig.defaultPlaceOfSupply || 'Karnataka (29)',
        totalAmount,
      },
    };

    const buffer = generateInvoicePdfBuffer(mockInvoice, draftConfig);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Invoice-Preview.pdf"`);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

    return res.send(buffer);
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Customer / Admin: Download Invoice PDF directly by Order ID
 */
export const downloadInvoicePdfForOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId).populate('items.product');
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const isOwner = order.user?.toString() === req.user._id?.toString();
    const isAdmin = ['super_admin', 'admin', 'manager'].includes(req.user.role);
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Not authorized to download invoice for this order' });
    }

    const invoice = await getOrCreateInvoiceForOrder(order, req.user);
    const { filename, buffer } = await getInvoicePdf(invoice._id, req.user);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

    return res.send(buffer);
  } catch (err) {
    console.error('Download invoice by order error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Customer / Admin: Get Invoice Details by Order ID
 */
export const getInvoiceForOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId).populate('items.product');
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const isOwner = order.user?.toString() === req.user._id?.toString();
    const isAdmin = ['super_admin', 'admin', 'manager'].includes(req.user.role);
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Not authorized to view invoice for this order' });
    }

    const invoice = await getOrCreateInvoiceForOrder(order, req.user);
    return res.status(200).json({
      success: true,
      invoice,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
