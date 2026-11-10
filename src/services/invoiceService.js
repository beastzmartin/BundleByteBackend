import Invoice from '../models/Invoice.js';
import CreditNote from '../models/CreditNote.js';
import Order from '../models/Order.js';
import User from '../models/User.js';
import WebsiteSetting from '../models/WebsiteSetting.js';
import { generateInvoicePdfBuffer } from './invoicePdfGenerator.js';

/**
 * Generates the next sequential invoice number (e.g. INV-2026-00001)
 */
export const generateNextInvoiceNumber = async () => {
  const currentYear = new Date().getFullYear();
  let prefix = `INV-${currentYear}-`;
  try {
    const settings = await WebsiteSetting.findOne().select('invoiceConfig');
    if (settings?.invoiceConfig?.invoicePrefix) {
      prefix = `${settings.invoiceConfig.invoicePrefix.trim().toUpperCase()}-${currentYear}-`;
    }
  } catch (e) {
    // fallback to INV
  }

  const latest = await Invoice.findOne({ invoiceNumber: new RegExp(`^${prefix}`) })
    .sort({ createdAt: -1 })
    .select('invoiceNumber');

  let nextSequence = 1;
  if (latest && latest.invoiceNumber) {
    const parts = latest.invoiceNumber.split('-');
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastSeq)) {
      nextSequence = lastSeq + 1;
    }
  }

  return `${prefix}${String(nextSequence).padStart(5, '0')}`;
};

/**
 * Generates the next sequential credit note number (e.g. CN-2026-00001)
 */
export const generateNextCreditNoteNumber = async () => {
  const currentYear = new Date().getFullYear();
  const prefix = `CN-${currentYear}-`;

  const latest = await CreditNote.findOne({ creditNoteNumber: new RegExp(`^${prefix}`) })
    .sort({ createdAt: -1 })
    .select('creditNoteNumber');

  let nextSequence = 1;
  if (latest && latest.creditNoteNumber) {
    const parts = latest.creditNoteNumber.split('-');
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastSeq)) {
      nextSequence = lastSeq + 1;
    }
  }

  return `${prefix}${String(nextSequence).padStart(5, '0')}`;
};

/**
 * Fetches latest active business contact coordinates for invoicing
 */
export const getBusinessInfoSnapshot = async () => {
  try {
    const TaxConfiguration = (await import('../models/TaxConfiguration.js')).default;
    const taxConfig = await TaxConfiguration.findOne();
    const settings = await WebsiteSetting.findOne();
    const invCfg = settings?.invoiceConfig || {};
    const branding = settings?.branding || {};
    return {
      companyName: invCfg.companyName || taxConfig?.businessLegalName || branding.companyName || 'BundleByte Technologies Pvt Ltd',
      companyLogo: invCfg.logoUrl || branding.logoUrl || '',
      businessAddress: invCfg.businessAddress || (taxConfig?.registeredAddress?.street
        ? `${taxConfig.registeredAddress.street}, ${taxConfig.registeredAddress.city}, ${taxConfig.registeredAddress.state} ${taxConfig.registeredAddress.pincode}`
        : branding.businessAddress || '100 Innovation Boulevard, Tech Park, Bangalore 560001'),
      emailAddress: invCfg.supportEmail || branding.supportEmail || 'billing@bundlebyte.com',
      contactPhone: invCfg.supportPhone || branding.contactPhone || '+91 80 4000 1234',
      gstin: invCfg.gstin || taxConfig?.gstin || branding.gstin || '29ABCDE1234F1Z5',
      websiteUrl: invCfg.websiteUrl || branding.websiteUrl || 'https://bundlebyte.com',
    };
  } catch (err) {
    return {
      companyName: 'BundleByte Technologies Pvt Ltd',
      companyLogo: '',
      businessAddress: '100 Innovation Boulevard, Tech Park, Bangalore 560001',
      emailAddress: 'billing@bundlebyte.com',
      contactPhone: '+91 80 4000 1234',
      gstin: '29ABCDE1234F1Z5',
      websiteUrl: 'https://bundlebyte.com',
    };
  }
};

/**
 * Generates or retrieves an existing immutable invoice for an Order
 */
export const getOrCreateInvoiceForOrder = async (orderOrId, userMaybe = null) => {
  const orderId = orderOrId._id || orderOrId;
  const existing = await Invoice.findOne({ order: orderId }).populate('order user');
  if (existing) {
    return existing;
  }

  const order = await Order.findById(orderId).populate('items.product');
  if (!order) {
    throw new Error(`Order not found: ${orderId}`);
  }

  const user = userMaybe || (await User.findById(order.user));
  const settings = await WebsiteSetting.findOne();
  const invConfig = settings?.invoiceConfig || {};
  const invoiceNumber = await generateNextInvoiceNumber();
  const businessInfo = await getBusinessInfoSnapshot();

  const clientUrl = process.env.CLIENT_URL || 'https://bundlebyte.com';
  const vaultUrl = `${clientUrl}/dashboard/vault`;

  const items = (order.items || []).map((item) => {
    const prodAccess = item.accessLink || item.product?.accessLink || vaultUrl;
    const guideUrl = item.setupGuideUrl || item.product?.setupGuideUrl || '';
    const key = (item.allocatedKeys && item.allocatedKeys.length > 0)
      ? item.allocatedKeys[0]
      : (item.product?.productKeys?.find((k) => !k.isUsed)?.key || '');
    const actSteps = item.activationProcess || item.product?.activationGuide || '';

    return {
      product: item.product?._id || item.product,
      productTitle: item.productTitle || item.product?.title || 'Digital Product',
      productLogo: item.productLogo || item.product?.logo || '',
      quantity: item.quantity || 1,
      unitPrice: item.unitPrice || 0,
      discount: item.discount || 0,
      tax: item.itemTaxAmount || ((item.cgst || 0) + (item.sgst || 0) + (item.igst || 0)) || 0,
      totalPrice: item.totalPrice || item.unitPrice * (item.quantity || 1),
      deliveryType: item.deliveryType || 'instant_automated',
      duration: item.duration || 'annual',
      planName: item.planName || '',
      validityText: item.validityText || item.planName || item.duration || 'Annual',
      accessExpiresAt: item.accessExpiresAt || null,
      durationValue: item.durationValue || 0,
      durationUnit: item.durationUnit || '',
      isLifetime: !!item.isLifetime || item.duration === 'lifetime',
      productAccessLink: prodAccess,
      setupGuideUrl: guideUrl,
      vaultUrl: vaultUrl,
      licenseKey: key,
      activationSteps: actSteps,
      hsnSac: item.hsnSac || '998434',
      taxRate: item.taxRate !== undefined ? item.taxRate : 18,
      taxableAmount: item.taxableAmount || (item.unitPrice * (item.quantity || 1)),
      cgst: item.cgst || 0,
      sgst: item.sgst || 0,
      igst: item.igst || 0,
    };
  });

  const subtotal = order.subtotal || order.totalAmount;
  const discount = order.discount || 0;
  const totalAmount = order.totalAmount;
  const taxAmount = order.taxAmount || 0;
  const taxDetails = order.taxDetails || {};
  const feeDetails = order.gatewayFeeDetails || {};

  const invoice = await Invoice.create({
    invoiceNumber,
    order: order._id,
    user: order.user,
    customerName: order.customerName || user?.name || 'Customer',
    customerEmail: order.customerEmail || user?.email || '',
    billingAddress: order.billingAddress || {
      company: '',
      street: '',
      city: '',
      state: '',
      zipCode: '',
      country: 'India',
      taxId: '',
    },
    items,
    financialSnapshot: {
      subtotal,
      taxableAmount: taxDetails.taxableAmount || Math.max(0, subtotal - discount),
      discount,
      couponDiscount: discount,
      couponCode: order.couponCode || '',
      walletAmountUsed: order.walletAmountUsed || 0,
      gatewayAmountPaid: order.gatewayAmountPaid || totalAmount,
      taxAmount,
      taxRate: taxAmount > 0 ? (taxDetails.isIntraState ? 18 : 18) : 0,
      taxType: 'GST',
      taxMode: taxDetails.taxMode || 'exclusive',
      placeOfSupply: taxDetails.placeOfSupply || order.billingAddress?.state || invConfig.defaultPlaceOfSupply || 'Karnataka',
      placeOfSupplyCode: taxDetails.customerStateCode || '29',
      isIntraState: taxDetails.isIntraState ?? true,
      taxBreakdown: {
        cgst: taxDetails.cgst !== undefined ? taxDetails.cgst : (taxDetails.isIntraState ? taxAmount / 2 : 0),
        sgst: taxDetails.sgst !== undefined ? taxDetails.sgst : (taxDetails.isIntraState ? taxAmount / 2 : 0),
        igst: taxDetails.igst !== undefined ? taxDetails.igst : (!taxDetails.isIntraState ? taxAmount : 0),
      },
      gatewayFeeDetails: {
        gatewayKey: feeDetails.gatewayKey || '',
        gatewayName: feeDetails.gatewayName || '',
        feePayer: feeDetails.feePayer || 'merchant_absorb',
        baseFee: feeDetails.baseFee || 0,
        feeGst: feeDetails.feeGst || 0,
        totalFee: feeDetails.totalFee || 0,
        customerSurcharge: feeDetails.customerSurcharge || 0,
      },
      additionalCharges: feeDetails.customerSurcharge || 0,
      totalAmount,
      currency: order.currency || 'INR',
    },
    paymentDetails: {
      paymentStatus: order.paymentStatus === 'paid' ? 'paid' : 'pending',
      paymentMethod: order.paymentMethod || 'mock',
      transactionId: order.paymentDetails?.transactionId || `TXN-${order.orderNumber}`,
      paidAt: order.paymentDetails?.paidAt || new Date(),
      gateway: order.paymentDetails?.gateway || order.paymentMethod,
    },
    businessInfo,
    invoiceDate: order.createdAt || new Date(),
    status: order.paymentStatus === 'paid' ? 'paid' : 'issued',
    showWarrantySection: invConfig.showWarrantySection !== undefined ? invConfig.showWarrantySection : true,
    warrantyText: invConfig.warrantyText || 'Includes Official 14-Day Replacement Warranty • 24/7 Concierge Support',
    notes: invConfig.footerNote || 'Thank you for your business. Digital goods are delivered into your customer vault.',
    terms: invConfig.termsText || 'Digital product sales are subject to our terms of service and standard refund policy.',
    invoiceConfigSnapshot: invConfig,
    idempotencyKey: `inv-order-${order._id}`,
  });

  return invoice;
};

/**
 * Creates a Credit Note when an order is refunded
 */
export const createCreditNoteForRefund = async ({ order, refund, user, reason }) => {
  const invoice = await Invoice.findOne({ order: order._id });
  if (!invoice) return null;

  const creditNoteNumber = await generateNextCreditNoteNumber();
  const businessInfo = await getBusinessInfoSnapshot();
  const taxFeeEngine = (await import('./taxFeeEngine.js')).default;
  const refundAmount = refund?.amount || order.totalAmount;
  const taxAdj = taxFeeEngine.calculateRefundTaxAdjustment({ originalOrder: order, refundAmount });

  const creditNote = await CreditNote.create({
    creditNoteNumber,
    invoice: invoice._id,
    order: order._id,
    user: order.user,
    refund: refund?._id || null,
    customerName: invoice.customerName,
    customerEmail: invoice.customerEmail,
    originalInvoiceNumber: invoice.invoiceNumber,
    refundAmount,
    taxAdjustment: {
      taxableAmountRefunded: taxAdj.taxableAmountRefunded,
      cgstRefunded: taxAdj.cgstRefunded,
      sgstRefunded: taxAdj.sgstRefunded,
      igstRefunded: taxAdj.igstRefunded,
      totalTaxRefunded: taxAdj.totalTaxRefunded,
      placeOfSupply: taxAdj.placeOfSupply,
      isIntraState: taxAdj.isIntraState,
    },
    currency: order.currency || 'INR',
    reason: reason || refund?.reason || 'Customer refund requested',
    items: invoice.items.map((it) => ({
      productTitle: it.productTitle,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      refundedAmount: it.totalPrice,
    })),
    status: 'issued',
    businessInfo,
  });

  invoice.status = 'refunded';
  invoice.creditNote = creditNote._id;
  invoice.creditNoteIssued = true;
  await invoice.save();

  return creditNote;
};

/**
 * Downloads or generates invoice PDF buffer with authorization check
 */
export const getInvoicePdf = async (invoiceId, requestingUser = null) => {
  const invoice = await Invoice.findById(invoiceId).populate({
    path: 'order',
    populate: { path: 'items.product' },
  });
  if (!invoice) {
    throw new Error('Invoice not found');
  }

  // Authorization check: User must be admin or the invoice recipient
  if (requestingUser) {
    const isOwner = invoice.user?.toString() === requestingUser._id?.toString();
    const isAdmin = ['super_admin', 'admin', 'manager'].includes(requestingUser.role);
    if (!isOwner && !isAdmin) {
      throw new Error('Not authorized to access this invoice');
    }
  }

  invoice.downloadCount += 1;
  invoice.lastDownloadedAt = new Date();
  await invoice.save();

  const settings = await WebsiteSetting.findOne().select('invoiceConfig');
  const invoiceConfig = invoice.invoiceConfigSnapshot || settings?.invoiceConfig || {};

  const pdfBuffer = generateInvoicePdfBuffer(invoice, invoiceConfig);
  return {
    filename: `Invoice-${invoice.invoiceNumber}.pdf`,
    buffer: pdfBuffer,
    invoice,
  };
};
