/**
 * Pure Node.js Standard Vector PDF Invoice Generator
 * Generates an A4 PDF document (595.28 x 841.89 pt) conforming to PDF 1.4 specs
 * with zero external C++ or headless browser dependencies.
 */

// Helper to escape PDF text strings
const escapePdfText = (str) => {
  if (!str) return '';
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/[\r\n]+/g, ' ');
};

export const generateInvoicePdfBuffer = (invoice) => {
  const width = 595.28;
  const height = 841.89;

  const business = invoice.businessInfo || {};
  const companyName = business.companyName || 'BundleByte Technologies Pvt Ltd';
  const businessAddress = business.businessAddress || '100 Innovation Boulevard, Tech Park, Bangalore 560001';
  const businessEmail = business.emailAddress || 'billing@bundlebyte.com';
  const businessPhone = business.contactPhone || '+91 80 4000 1234';
  const gstin = business.gstin || '29ABCDE1234F1Z5';

  const customerName = invoice.customerName || 'Valued Customer';
  const customerEmail = invoice.customerEmail || '';
  const orderNumber = invoice.order?.orderNumber || invoice.orderNumber || 'N/A';
  const invoiceNumber = invoice.invoiceNumber || 'INV-00000';
  const invoiceDate = new Date(invoice.invoiceDate || Date.now()).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const paymentMethod = (invoice.paymentDetails?.paymentMethod || 'Online').toUpperCase();
  const transactionId = invoice.paymentDetails?.transactionId || 'TXN-' + Math.random().toString(36).substring(2, 9).toUpperCase();

  const financial = invoice.financialSnapshot || {};
  const currencySymbol = financial.currency === 'USD' ? '$' : 'Rs.';
  const subtotal = (financial.subtotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const discount = (financial.discount || financial.couponDiscount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const walletUsed = (financial.walletAmountUsed || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const taxAmount = (financial.taxAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const totalAmount = (financial.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Stream commands
  const streamLines = [];

  // 1. Top Indigo Accent Bar
  streamLines.push('q');
  streamLines.push('0.31 0.27 0.90 rg'); // #4f46e5
  streamLines.push(`0 ${height - 8} ${width} 8 re f`);
  streamLines.push('Q');

  // 2. Header Background Box
  streamLines.push('q');
  streamLines.push('0.06 0.09 0.16 rg'); // #0f172a
  streamLines.push(`0 ${height - 120} ${width} 112 re f`);
  streamLines.push('Q');

  // 3. Header Texts (Brand & Tax Invoice)
  streamLines.push('BT');
  streamLines.push('/F2 24 Tf'); // Helvetica-Bold 24pt
  streamLines.push('1 1 1 rg'); // White
  streamLines.push(`40 ${height - 48} Td`);
  streamLines.push(`(BundleByte) Tj`);
  streamLines.push('ET');

  streamLines.push('BT');
  streamLines.push('/F1 9 Tf');
  streamLines.push('0.58 0.64 0.72 rg'); // #94a3b8
  streamLines.push(`40 ${height - 64} Td`);
  streamLines.push(`(${escapePdfText(companyName)} | Digital Marketplace) Tj`);
  streamLines.push('ET');

  streamLines.push('BT');
  streamLines.push('/F1 8 Tf');
  streamLines.push('0.58 0.64 0.72 rg');
  streamLines.push(`40 ${height - 78} Td`);
  streamLines.push(`(GSTIN: ${escapePdfText(gstin)} | ${escapePdfText(businessEmail)}) Tj`);
  streamLines.push('ET');

  // TAX INVOICE title on the right
  streamLines.push('BT');
  streamLines.push('/F2 20 Tf');
  streamLines.push('1 1 1 rg');
  streamLines.push(`400 ${height - 48} Td`);
  streamLines.push('(TAX INVOICE) Tj');
  streamLines.push('ET');

  streamLines.push('BT');
  streamLines.push('/F2 11 Tf');
  streamLines.push('0.51 0.76 1.0 rg');
  streamLines.push(`400 ${height - 66} Td`);
  streamLines.push(`(${escapePdfText(invoiceNumber)}) Tj`);
  streamLines.push('ET');

  // Paid Status Pill
  streamLines.push('q');
  streamLines.push('0.13 0.55 0.35 rg'); // #22c55e (green)
  streamLines.push(`400 ${height - 98} 72 20 re f`);
  streamLines.push('Q');

  streamLines.push('BT');
  streamLines.push('/F2 10 Tf');
  streamLines.push('1 1 1 rg');
  streamLines.push(`418 ${height - 85} Td`);
  streamLines.push('(PAID) Tj');
  streamLines.push('ET');

  // 4. Meta Details Section (2 Columns)
  const metaY = height - 150;
  streamLines.push('q');
  streamLines.push('0.97 0.98 0.99 rg'); // Light slate bg #f8fafc
  streamLines.push('0.85 0.88 0.92 RG'); // Border #cbd5e1
  streamLines.push(`40 ${metaY - 70} ${width - 80} 70 re B`);
  streamLines.push('Q');

  // Left column: Customer
  streamLines.push('BT');
  streamLines.push('/F2 9 Tf');
  streamLines.push('0.28 0.35 0.44 rg');
  streamLines.push(`55 ${metaY - 20} Td`);
  streamLines.push('(BILLED TO:) Tj');
  streamLines.push('ET');

  streamLines.push('BT');
  streamLines.push('/F2 10 Tf');
  streamLines.push('0.06 0.09 0.16 rg');
  streamLines.push(`55 ${metaY - 35} Td`);
  streamLines.push(`(${escapePdfText(customerName)}) Tj`);
  streamLines.push('ET');

  streamLines.push('BT');
  streamLines.push('/F1 9 Tf');
  streamLines.push('0.38 0.44 0.53 rg');
  streamLines.push(`55 ${metaY - 50} Td`);
  streamLines.push(`(${escapePdfText(customerEmail)}) Tj`);
  streamLines.push('ET');

  // Right column: Order & Payment
  streamLines.push('BT');
  streamLines.push('/F1 9 Tf');
  streamLines.push('0.28 0.35 0.44 rg');
  streamLines.push(`320 ${metaY - 20} Td`);
  streamLines.push(`(Invoice Date: ${escapePdfText(invoiceDate)}) Tj`);
  streamLines.push('ET');

  streamLines.push('BT');
  streamLines.push('/F1 9 Tf');
  streamLines.push('0.28 0.35 0.44 rg');
  streamLines.push(`320 ${metaY - 35} Td`);
  streamLines.push(`(Order Number: #${escapePdfText(orderNumber)}) Tj`);
  streamLines.push('ET');

  streamLines.push('BT');
  streamLines.push('/F1 9 Tf');
  streamLines.push('0.28 0.35 0.44 rg');
  streamLines.push(`320 ${metaY - 50} Td`);
  streamLines.push(`(Payment: ${escapePdfText(paymentMethod)} | Txn: ${escapePdfText(transactionId.substring(0, 16))}) Tj`);
  streamLines.push('ET');

  // 5. Items Table
  let tableY = metaY - 100;
  streamLines.push('q');
  streamLines.push('0.12 0.16 0.23 rg'); // #1e293b dark table header
  streamLines.push(`40 ${tableY} ${width - 80} 24 re f`);
  streamLines.push('Q');

  // Table Headers
  streamLines.push('BT');
  streamLines.push('/F2 9 Tf');
  streamLines.push('1 1 1 rg');
  streamLines.push(`50 ${tableY + 7} Td`);
  streamLines.push('(ITEM / PRODUCT DESCRIPTION) Tj');
  streamLines.push(`280 0 Td`);
  streamLines.push('(TYPE) Tj');
  streamLines.push(`60 0 Td`);
  streamLines.push('(QTY) Tj');
  streamLines.push(`50 0 Td`);
  streamLines.push('(UNIT PRICE) Tj');
  streamLines.push(`60 0 Td`);
  streamLines.push('(TOTAL) Tj');
  streamLines.push('ET');

  tableY -= 26;

  const items = invoice.items || [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const isEven = i % 2 === 0;

    // Row background
    if (isEven) {
      streamLines.push('q');
      streamLines.push('0.98 0.98 0.99 rg');
      streamLines.push(`40 ${tableY - 4} ${width - 80} 24 re f`);
      streamLines.push('Q');
    }

    const title = escapePdfText(item.productTitle || 'Digital License Item').substring(0, 42);
    const type = escapePdfText((item.deliveryType || 'automated').replace(/_/g, ' '));
    const qty = String(item.quantity || 1);
    const unitPrice = `${currencySymbol} ${(item.unitPrice || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    const lineTotal = `${currencySymbol} ${(item.totalPrice || item.unitPrice * item.quantity || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

    streamLines.push('BT');
    streamLines.push('/F2 9 Tf');
    streamLines.push('0.06 0.09 0.16 rg');
    streamLines.push(`50 ${tableY + 3} Td`);
    streamLines.push(`(${title}) Tj`);
    streamLines.push('ET');

    streamLines.push('BT');
    streamLines.push('/F1 8 Tf');
    streamLines.push('0.38 0.44 0.53 rg');
    streamLines.push(`330 ${tableY + 3} Td`);
    streamLines.push(`(${type}) Tj`);
    streamLines.push(`60 0 Td`);
    streamLines.push(`(${qty}) Tj`);
    streamLines.push(`50 0 Td`);
    streamLines.push(`(${unitPrice}) Tj`);
    streamLines.push('ET');

    streamLines.push('BT');
    streamLines.push('/F2 9 Tf');
    streamLines.push('0.06 0.09 0.16 rg');
    streamLines.push(`500 ${tableY + 3} Td`);
    streamLines.push(`(${lineTotal}) Tj`);
    streamLines.push('ET');

    tableY -= 24;
  }

  // Divider line after items
  streamLines.push('q');
  streamLines.push('0.85 0.88 0.92 RG');
  streamLines.push(`40 ${tableY + 8} m ${width - 40} ${tableY + 8} l S`);
  streamLines.push('Q');

  // 6. Summary Card (Right-aligned)
  const summaryTop = tableY - 10;
  const summaryLeft = 320;
  const summaryWidth = width - 40 - summaryLeft;

  streamLines.push('q');
  streamLines.push('0.97 0.98 0.99 rg');
  streamLines.push('0.85 0.88 0.92 RG');
  streamLines.push(`${summaryLeft} ${summaryTop - 110} ${summaryWidth} 110 re B`);
  streamLines.push('Q');

  const printSummaryRow = (label, value, yOffset, isBold = false, isAccent = false) => {
    streamLines.push('BT');
    streamLines.push(isBold ? '/F2 9 Tf' : '/F1 9 Tf');
    streamLines.push(isAccent ? '0.31 0.27 0.90 rg' : '0.28 0.35 0.44 rg');
    streamLines.push(`${summaryLeft + 15} ${summaryTop - yOffset} Td`);
    streamLines.push(`(${label}) Tj`);
    streamLines.push('ET');

    streamLines.push('BT');
    streamLines.push(isBold ? '/F2 9 Tf' : '/F1 9 Tf');
    streamLines.push(isAccent ? '0.31 0.27 0.90 rg' : '0.06 0.09 0.16 rg');
    streamLines.push(`${summaryLeft + summaryWidth - 75} ${summaryTop - yOffset} Td`);
    streamLines.push(`(${value}) Tj`);
    streamLines.push('ET');
  };

  printSummaryRow('Subtotal:', `${currencySymbol} ${subtotal}`, 22);
  if (financial.discount > 0 || financial.couponDiscount > 0) {
    printSummaryRow('Discount:', `-${currencySymbol} ${discount}`, 40);
  }
  if (financial.walletAmountUsed > 0) {
    printSummaryRow('Wallet Balance Used:', `-${currencySymbol} ${walletUsed}`, 58);
  }
  printSummaryRow('Tax / GST Included:', `${currencySymbol} ${taxAmount}`, 76);

  // Grand total divider
  streamLines.push('q');
  streamLines.push('0.85 0.88 0.92 RG');
  streamLines.push(`${summaryLeft} ${summaryTop - 84} m ${summaryLeft + summaryWidth} ${summaryTop - 84} l S`);
  streamLines.push('Q');

  printSummaryRow('Grand Total:', `${currencySymbol} ${totalAmount}`, 100, true, true);

  // 7. Security & Authenticity Hash on bottom-left
  streamLines.push('BT');
  streamLines.push('/F2 8 Tf');
  streamLines.push('0.28 0.35 0.44 rg');
  streamLines.push(`40 ${summaryTop - 20} Td`);
  streamLines.push('(TERMS & AUTHENTICITY NOTE:) Tj');
  streamLines.push('ET');

  streamLines.push('BT');
  streamLines.push('/F1 8 Tf');
  streamLines.push('0.48 0.55 0.63 rg');
  streamLines.push(`40 ${summaryTop - 34} Td`);
  streamLines.push('(1. This is a computer-generated tax invoice and requires no physical signature.) Tj');
  streamLines.push(`0 -12 Td`);
  streamLines.push('(2. Genuine perpetual licenses and account credentials reside in your encrypted vault.) Tj');
  streamLines.push(`0 -12 Td`);
  streamLines.push(`(3. Authenticity verification reference: BB-INV-${invoiceNumber.replace(/[^0-9]/g, '')}-${orderNumber}) Tj`);
  streamLines.push('ET');

  // 8. Footer Bar
  streamLines.push('q');
  streamLines.push('0.06 0.09 0.16 rg');
  streamLines.push(`0 0 ${width} 44 re f`);
  streamLines.push('Q');

  streamLines.push('BT');
  streamLines.push('/F1 8 Tf');
  streamLines.push('0.58 0.64 0.72 rg');
  streamLines.push(`40 24 Td`);
  streamLines.push(`(${escapePdfText(companyName)} | ${escapePdfText(businessAddress)}) Tj`);
  streamLines.push('ET');

  streamLines.push('BT');
  streamLines.push('/F1 8 Tf');
  streamLines.push('0.58 0.64 0.72 rg');
  streamLines.push(`40 12 Td`);
  streamLines.push(`(Support concierge: ${escapePdfText(businessEmail)} | Phone: ${escapePdfText(businessPhone)}) Tj`);
  streamLines.push('ET');

  const contentStream = streamLines.join('\n');
  const streamLength = Buffer.byteLength(contentStream, 'utf8');

  // Assemble PDF document objects
  const objects = [];
  const offsets = [];

  const addObj = (str) => {
    objects.push(str);
  };

  // Obj 1: Catalog
  addObj(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj`);

  // Obj 2: Pages
  addObj(`2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj`);

  // Obj 3: Page
  addObj(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>\nendobj`);

  // Obj 4: Content stream
  addObj(`4 0 obj\n<< /Length ${streamLength} >>\nstream\n${contentStream}\nendstream\nendobj`);

  // Obj 5: Font F1 (Helvetica)
  addObj(`5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj`);

  // Obj 6: Font F2 (Helvetica-Bold)
  addObj(`6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj`);

  // Calculate byte offsets
  let header = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  let currentOffset = Buffer.byteLength(header, 'utf8');

  for (let i = 0; i < objects.length; i++) {
    offsets.push(currentOffset);
    currentOffset += Buffer.byteLength(objects[i] + '\n', 'utf8');
  }

  // Cross-reference table
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 0; i < offsets.length; i++) {
    const pad = String(offsets[i]).padStart(10, '0');
    xref += `${pad} 00000 n \n`;
  }

  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${currentOffset}\n%%EOF\n`;

  const finalPdf = header + objects.join('\n') + '\n' + xref + trailer;
  return Buffer.from(finalPdf, 'utf8');
};
