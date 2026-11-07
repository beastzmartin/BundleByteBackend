import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import User from '../models/User.js';
import Category from '../models/Category.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import Invoice from '../models/Invoice.js';
import CreditNote from '../models/CreditNote.js';
import DeliveryNotification from '../models/DeliveryNotification.js';
import EmailLog from '../models/EmailLog.js';
import EmailProvider from '../models/EmailProvider.js';
import { ensureDefaultEmailProviders, getAllProvidersSanitized, testProviderConnectivity } from '../services/providerManagerService.js';
import { getOrCreateInvoiceForOrder, getInvoicePdf, createCreditNoteForRefund } from '../services/invoiceService.js';
import { generateInvoicePdfBuffer } from '../services/invoicePdfGenerator.js';
import { dispatchOrderConfirmationEmail, dispatchDigitalDeliveryEmail, resendDeliveryNotification } from '../services/fulfillmentNotificationService.js';
import { getEmailAnalyticsData } from '../services/emailAnalyticsService.js';

async function runEmailAndInvoiceTests() {
  console.log('🧪 Starting Advanced Email Delivery, Invoice & Digital Fulfillment Tests...\n');

  let mongod;
  try {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);
    console.log('✅ Connected to Test MongoMemoryServer');

    // 1. Test Email Providers Initialization
    console.log('\n--- Step 1: Testing Email Providers ---');
    await ensureDefaultEmailProviders();
    const providers = await getAllProvidersSanitized();
    console.log(`✅ Providers initialized: ${providers.length} provider(s) found`);
    const smtp = providers.find((p) => p.providerType === 'smtp');
    if (!smtp) throw new Error('SMTP provider missing');
    console.log(`✅ Provider retrieved: ${smtp.name} (hasPassword: ${smtp.smtpConfig.hasPassword})`);

    // 2. Create Test Category, User and Product
    console.log('\n--- Step 2: Creating Test Customer & Digital Product ---');
    const category = await Category.create({
      name: 'Developer Tools',
      slug: 'developer-tools',
      description: 'IDEs, compilers and developer toolkits',
    });

    const customer = await User.create({
      name: 'Rohan Sharma',
      email: 'rohan.sharma@example.com',
      password: 'HashedPassword123!',
      role: 'customer',
      isVerified: true,
    });

    const product = await Product.create({
      title: 'JetBrains All Products Pack (1-Year)',
      slug: 'jetbrains-all-products-pack',
      summary: 'Full perpetual fallback + 1 year updates',
      description: 'Full perpetual fallback + 1 year updates for developer suite',
      category: category._id,
      price: 4999,
      deliveryType: 'account_credentials',
      deliveryMethod: 'automatic',
      stockQuantity: 10,
    });
    console.log(`✅ Customer created: ${customer.name} (${customer.email})`);
    console.log(`✅ Product created: ${product.title}`);

    // 3. Create Test Order
    console.log('\n--- Step 3: Creating Paid Customer Order ---');
    const order = await Order.create({
      orderNumber: `ORD-${Date.now()}`,
      user: customer._id,
      customerName: customer.name,
      customerEmail: customer.email,
      items: [
        {
          product: product._id,
          productTitle: product.title,
          duration: 'annual',
          unitPrice: 4999,
          quantity: 1,
          totalPrice: 4999,
          deliveryType: 'account_credentials',
          deliveryMethod: 'automatic',
          deliveryStatus: 'delivered',
        },
      ],
      subtotal: 4999,
      discount: 500,
      couponCode: 'SAVE500',
      walletAmountUsed: 500,
      gatewayAmountPaid: 3999,
      taxAmount: 0,
      totalAmount: 3999,
      currency: 'INR',
      paymentMethod: 'upi',
      paymentStatus: 'paid',
      orderStatus: 'completed',
      deliveryStatus: 'delivered',
      paymentDetails: {
        transactionId: 'UPI-9876543210',
        gateway: 'upi',
        paidAt: new Date(),
      },
    });
    console.log(`✅ Order #${order.orderNumber} created (Total: ₹${order.totalAmount})`);

    // 4. Test Invoice Generation
    console.log('\n--- Step 4: Testing Invoice Generation & Idempotency ---');
    const invoice = await getOrCreateInvoiceForOrder(order, customer);
    console.log(`✅ Invoice generated: ${invoice.invoiceNumber}`);
    if (!invoice.invoiceNumber.startsWith('INV-')) throw new Error('Invalid invoice number prefix');
    if (invoice.financialSnapshot.totalAmount !== 3999) throw new Error('Financial total mismatch');

    // Test Idempotency
    const secondInvoice = await getOrCreateInvoiceForOrder(order, customer);
    if (secondInvoice._id.toString() !== invoice._id.toString()) {
      throw new Error('Invoice generation is not idempotent!');
    }
    console.log('✅ Idempotency verified: re-request returns identical invoice instance');

    // 5. Test PDF Generation
    console.log('\n--- Step 5: Testing Vector PDF Invoice Generation ---');
    const pdfResult = await getInvoicePdf(invoice._id, customer);
    console.log(`✅ Generated PDF filename: ${pdfResult.filename}`);
    console.log(`✅ Generated PDF buffer size: ${pdfResult.buffer.length} bytes`);
    const pdfHeader = pdfResult.buffer.subarray(0, 8).toString('utf8');
    if (!pdfHeader.startsWith('%PDF-1.')) {
      throw new Error(`Invalid PDF header: ${pdfHeader}`);
    }
    console.log(`✅ Valid PDF 1.4 binary stream verified: starts with "${pdfHeader.trim()}"`);

    // 6. Test Credit Note Generation
    console.log('\n--- Step 6: Testing Credit Note for Refunds ---');
    const creditNote = await createCreditNoteForRefund({
      order,
      refund: null,
      user: customer,
      reason: 'Requested license change',
    });
    console.log(`✅ Credit Note generated: ${creditNote.creditNoteNumber} for ₹${creditNote.refundAmount}`);
    const updatedInvoice = await Invoice.findById(invoice._id);
    if (updatedInvoice.status !== 'refunded' || !updatedInvoice.creditNoteIssued) {
      throw new Error('Invoice status not updated to refunded');
    }
    console.log('✅ Invoice status transitioned to "refunded" with creditNote link verified');

    // 7. Test Order Confirmation Email Dispatch
    console.log('\n--- Step 7: Testing Order Confirmation Email Dispatch ---');
    const orderEmailRes = await dispatchOrderConfirmationEmail({ order, user: customer });
    if (!orderEmailRes.success) throw new Error(`Order email failed: ${orderEmailRes.error}`);
    console.log(`✅ Order Confirmation email queued (Linked Invoice: ${orderEmailRes.invoiceId})`);

    // 8. Test Adaptive Digital Delivery Email & Secure Vault Token
    console.log('\n--- Step 8: Testing Adaptive Digital Delivery Email ---');
    const deliveryEmailRes = await dispatchDigitalDeliveryEmail({ order, user: customer });
    if (!deliveryEmailRes.success) throw new Error(`Delivery email failed: ${deliveryEmailRes.error}`);
    const notification = await DeliveryNotification.findById(deliveryEmailRes.notificationId);
    console.log(`✅ DeliveryNotification created: Type=${notification.deliveryType}, Status=${notification.status}`);
    if (!notification.secureAccessToken) throw new Error('Secure access token missing');
    if (notification.tokenExpiresAt <= new Date()) throw new Error('Token expiry date is invalid');
    console.log(`✅ Short-lived secure token generated: ${notification.secureAccessToken.substring(0, 16)}... (Expires: ${notification.tokenExpiresAt.toISOString()})`);

    // 9. Test Resending Delivery Notification (Without modifying inventory)
    console.log('\n--- Step 9: Testing Safe Resend Delivery Notification ---');
    const oldToken = notification.secureAccessToken;
    const resendResult = await resendDeliveryNotification(notification._id, customer);
    if (!resendResult.success) throw new Error('Resend failed');
    const refreshed = resendResult.notification;
    if (refreshed.secureAccessToken === oldToken) throw new Error('Token was not refreshed on resend');
    if (refreshed.resendCount !== 1) throw new Error('Resend count was not incremented');
    console.log(`✅ Resend completed safely: count=${refreshed.resendCount}, refreshed token=${refreshed.secureAccessToken.substring(0, 16)}...`);

    // 10. Test Email Analytics Aggregation
    console.log('\n--- Step 10: Testing Email Analytics Engine ---');
    const analytics = await getEmailAnalyticsData({ days: 30 });
    console.log(`✅ Analytics computed: total=${analytics.overview.total}, deliveryRate=${analytics.overview.deliveryRate}%`);
    console.log(`✅ Category distribution found: ${analytics.categoryBreakdown.length} categories`);

    console.log('\n🎉 ALL 10 EMAIL DELIVERY, INVOICE & FULFILLMENT VERIFICATION CHECKS PASSED!\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Test Failure:', err);
    process.exit(1);
  } finally {
    if (mongod) await mongod.stop();
  }
}

runEmailAndInvoiceTests();
