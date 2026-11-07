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
  const prefix = `INV-${currentYear}-`;

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
    const settings = await WebsiteSetting.findOne();
    const branding = settings?.branding || {};
    return {
      companyName: branding.companyName || 'BundleByte Technologies Pvt Ltd',
      companyLogo: branding.logoUrl || '',
      businessAddress: branding.businessAddress || '100 Innovation Boulevard, Tech Park, Bangalore 560001',
      emailAddress: branding.supportEmail || 'billing@bundlebyte.com',
      contactPhone: branding.contactPhone || '+91 80 4000 1234',
      gstin: branding.gstin || '29ABCDE1234F1Z5',
      websiteUrl: branding.websiteUrl || 'https://bundlebyte.com',
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
  const invoiceNumber = await generateNextInvoiceNumber();
  const businessInfo = await getBusinessInfoSnapshot();

  const items = (order.items || []).map((item) => ({
    product: item.product?._id || item.product,
    productTitle: item.productTitle || item.product?.title || 'Digital Product',
    productLogo: item.productLogo || item.product?.logo || '',
    quantity: item.quantity || 1,
    unitPrice: item.unitPrice || 0,
    discount: item.discount || 0,
    tax: 0,
    totalPrice: item.totalPrice || item.unitPrice * (item.quantity || 1),
    deliveryType: item.deliveryType || 'instant_automated',
    duration: item.duration || 'annual',
  }));

  const subtotal = order.subtotal || order.totalAmount;
  const discount = order.discount || 0;
  const totalAmount = order.totalAmount;
  const taxAmount = order.taxAmount || 0;

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
      discount,
      couponDiscount: discount,
      couponCode: order.couponCode || '',
      walletAmountUsed: order.walletAmountUsed || 0,
      gatewayAmountPaid: order.gatewayAmountPaid || totalAmount,
      taxAmount,
      taxRate: taxAmount > 0 ? 18 : 0,
      taxType: 'GST',
      taxBreakdown: {
        cgst: taxAmount / 2,
        sgst: taxAmount / 2,
        igst: 0,
      },
      additionalCharges: 0,
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

  const creditNote = await CreditNote.create({
    creditNoteNumber,
    invoice: invoice._id,
    order: order._id,
    user: order.user,
    refund: refund?._id || null,
    customerName: invoice.customerName,
    customerEmail: invoice.customerEmail,
    originalInvoiceNumber: invoice.invoiceNumber,
    refundAmount: refund?.amount || order.totalAmount,
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
  const invoice = await Invoice.findById(invoiceId).populate('order');
  if (!invoice) {
    throw new Error('Invoice not found');
  }

  // Authorization check: User must be admin or the invoice recipient
  if (requestingUser) {
    const isOwner = invoice.user.toString() === requestingUser._id.toString();
    const isAdmin = ['super_admin', 'admin', 'manager'].includes(requestingUser.role);
    if (!isOwner && !isAdmin) {
      throw new Error('Not authorized to access this invoice');
    }
  }

  invoice.downloadCount += 1;
  invoice.lastDownloadedAt = new Date();
  await invoice.save();

  const pdfBuffer = generateInvoicePdfBuffer(invoice);
  return {
    filename: `Invoice-${invoice.invoiceNumber}.pdf`,
    buffer: pdfBuffer,
    invoice,
  };
};
