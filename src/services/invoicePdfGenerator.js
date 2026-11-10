/**
 * Pure Node.js Standard Vector PDF Invoice Generator
 * Generates an A4 PDF document (595.28 x 841.89 pt) conforming to PDF 1.4 specs
 * with zero external binary or headless browser dependencies.
 *
 * Supports:
 * - Dynamic customizable styling (accent & header colors, titles, logos, prefixes)
 * - Clickable PDF interactive hyperlinks (/Subtype /Link /A << /S /URI ... >>)
 * - Digital product access links, setup guides, and encrypted vault links
 * - Monospace license key previews
 * - Dynamic row heights & collision-proof vertical flow
 * - GST compliance (CGST/SGST/IGST, HSN/SAC, place of supply)
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

// Helper to escape PDF URI strings
const escapePdfUri = (str) => {
  if (!str) return '';
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/ /g, '%20');
};

// Converts hex color (#4f46e5) to PDF RGB array [r, g, b] (0..1)
const hexToRgb = (hex, fallback = [0.31, 0.27, 0.90]) => {
  if (!hex || typeof hex !== 'string') return fallback;
  const clean = hex.replace('#', '').trim();
  if (clean.length !== 6 && clean.length !== 3) return fallback;
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const num = parseInt(full, 16);
  if (isNaN(num)) return fallback;
  const r = ((num >> 16) & 255) / 255;
  const g = ((num >> 8) & 255) / 255;
  const b = (num & 255) / 255;
  return [Number(r.toFixed(3)), Number(g.toFixed(3)), Number(b.toFixed(3))];
};

export const generateInvoicePdfBuffer = (invoice, invoiceConfig = {}) => {
  const width = 595.28;
  const height = 841.89;

  // Configuration and Branding
  const config = {
    companyName: 'BundleByte Technologies Pvt Ltd',
    businessAddress: '100 Innovation Boulevard, Tech Park, Bangalore 560001',
    supportEmail: 'billing@bundlebyte.com',
    supportPhone: '+91 80 4000 1234',
    gstin: '29ABCDE1234F1Z5',
    websiteUrl: 'https://bundlebyte.com',
    invoiceTitle: 'TAX INVOICE',
    accentColor: '#4f46e5',
    secondaryColor: '#0f172a',
    showAccessLinks: true,
    accessButtonLabel: 'Access Product & Vault',
    showLicenseKeyPreview: true,
    showHsnSac: true,
    showGstBreakdown: true,
    termsText:
      '1. Genuine perpetual licenses and account credentials reside in your encrypted customer vault.\n2. Sale is subject to standard terms of service & 14-day replacement warranty.\n3. This is a computer-generated tax invoice and requires no physical signature.',
    footerNote:
      'Official tax receipt for verified digital software licenses. Registered in accordance with online merchant standards.',
    ...invoiceConfig,
  };

  const business = invoice.businessInfo || {};
  const companyName = config.companyName || business.companyName || 'BundleByte Technologies Pvt Ltd';
  const businessAddress = config.businessAddress || business.businessAddress || '100 Innovation Boulevard, Tech Park, Bangalore 560001';
  const businessEmail = config.supportEmail || business.emailAddress || 'billing@bundlebyte.com';
  const businessPhone = config.supportPhone || business.contactPhone || '+91 80 4000 1234';
  const gstin = config.gstin || business.gstin || '29ABCDE1234F1Z5';
  const websiteUrl = config.websiteUrl || business.websiteUrl || 'https://bundlebyte.com';

  const [accentR, accentG, accentB] = hexToRgb(config.accentColor, [0.31, 0.27, 0.90]);
  const [secR, secG, secB] = hexToRgb(config.secondaryColor, [0.06, 0.09, 0.16]);

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
  const transactionId =
    invoice.paymentDetails?.transactionId || 'TXN-' + Math.random().toString(36).substring(2, 9).toUpperCase();

  const financial = invoice.financialSnapshot || {};
  const currencySymbol = financial.currency === 'USD' ? '$' : 'Rs.';
  const subtotal = (financial.subtotal || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const discount = (financial.discount || financial.couponDiscount || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const taxAmount = (financial.taxAmount || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const totalAmount = (financial.totalAmount || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const streamLines = [];
  const linkAnnotations = [];

  // Helper to add interactive URI annotation
  const addLink = (x1, y1, x2, y2, url) => {
    if (!url) return;
    linkAnnotations.push(
      `<< /Type /Annot /Subtype /Link /Rect [${x1.toFixed(2)} ${y1.toFixed(2)} ${x2.toFixed(2)} ${y2.toFixed(2)}] /Border [0 0 0] /A << /S /URI /URI (${escapePdfUri(url)}) >> >>`
    );
  };

  // 1. Top Accent Color Bar
  streamLines.push('q');
  streamLines.push(`${accentR} ${accentG} ${accentB} rg`);
  streamLines.push(`0 ${height - 6} ${width} 6 re f`);
  streamLines.push('Q');

  // 2. Header Box (Brand & Invoice Title)
  streamLines.push('q');
  streamLines.push(`${secR} ${secG} ${secB} rg`);
  streamLines.push(`0 ${height - 116} ${width} 110 re f`);
  streamLines.push('Q');

  // Brand Name & Logo Placeholder
  streamLines.push('BT');
  streamLines.push('/F2 22 Tf');
  streamLines.push('1 1 1 rg');
  streamLines.push(`40 ${height - 42} Td`);
  streamLines.push(`(BundleByte) Tj`);
  streamLines.push('ET');

  // Link brand logo to website
  addLink(40, height - 50, 160, height - 25, websiteUrl);

  streamLines.push('BT');
  streamLines.push('/F1 8.5 Tf');
  streamLines.push('0.68 0.74 0.82 rg');
  streamLines.push(`40 ${height - 58} Td`);
  streamLines.push(`(${escapePdfText(companyName)} | Digital Marketplace) Tj`);
  streamLines.push('ET');

  streamLines.push('BT');
  streamLines.push('/F1 8 Tf');
  streamLines.push('0.58 0.64 0.72 rg');
  streamLines.push(`40 ${height - 72} Td`);
  streamLines.push(`(GSTIN: ${escapePdfText(gstin)} | ${escapePdfText(businessEmail)}) Tj`);
  streamLines.push('ET');

  streamLines.push('BT');
  streamLines.push('/F1 7.5 Tf');
  streamLines.push('0.58 0.64 0.72 rg');
  streamLines.push(`40 ${height - 84} Td`);
  streamLines.push(`(${escapePdfText(businessAddress).substring(0, 75)}) Tj`);
  streamLines.push('ET');

  // INVOICE TITLE on the right
  const titleText = (config.invoiceTitle || 'TAX INVOICE').toUpperCase();
  streamLines.push('BT');
  streamLines.push('/F2 18 Tf');
  streamLines.push('1 1 1 rg');
  streamLines.push(`380 ${height - 42} Td`);
  streamLines.push(`(${escapePdfText(titleText)}) Tj`);
  streamLines.push('ET');

  streamLines.push('BT');
  streamLines.push('/F2 10.5 Tf');
  streamLines.push('0.55 0.78 1.0 rg');
  streamLines.push(`380 ${height - 58} Td`);
  streamLines.push(`(${escapePdfText(invoiceNumber)}) Tj`);
  streamLines.push('ET');

  // Paid Status Badge
  const isPaid = invoice.status === 'paid' || invoice.paymentDetails?.paymentStatus === 'paid';
  const badgeText = isPaid ? 'PAID IN FULL' : (invoice.status || 'ISSUED').toUpperCase();
  streamLines.push('q');
  if (isPaid) {
    streamLines.push('0.10 0.55 0.32 rg'); // emerald green
  } else {
    streamLines.push('0.85 0.55 0.10 rg'); // amber
  }
  streamLines.push(`380 ${height - 90} 86 18 re f`);
  streamLines.push('Q');

  streamLines.push('BT');
  streamLines.push('/F2 8.5 Tf');
  streamLines.push('1 1 1 rg');
  streamLines.push(`394 ${height - 78} Td`);
  streamLines.push(`(${escapePdfText(badgeText)}) Tj`);
  streamLines.push('ET');

  // 3. Metadata Section (Customer & Order details)
  const metaY = height - 132;
  const metaBoxHeight = 64;
  streamLines.push('q');
  streamLines.push('0.97 0.98 0.99 rg'); // #f8fafc
  streamLines.push('0.85 0.88 0.92 RG'); // #cbd5e1
  streamLines.push(`40 ${metaY - metaBoxHeight} ${width - 80} ${metaBoxHeight} re B`);
  streamLines.push('Q');

  // Left Column: Customer
  streamLines.push('BT');
  streamLines.push('/F2 8 Tf');
  streamLines.push('0.35 0.42 0.52 rg');
  streamLines.push(`52 ${metaY - 16} Td`);
  streamLines.push('(BILLED TO:) Tj');
  streamLines.push('ET');

  streamLines.push('BT');
  streamLines.push('/F2 9.5 Tf');
  streamLines.push('0.06 0.09 0.16 rg');
  streamLines.push(`52 ${metaY - 29} Td`);
  streamLines.push(`(${escapePdfText(customerName)}) Tj`);
  streamLines.push('ET');

  streamLines.push('BT');
  streamLines.push('/F1 8.5 Tf');
  streamLines.push('0.35 0.42 0.52 rg');
  streamLines.push(`52 ${metaY - 42} Td`);
  streamLines.push(`(${escapePdfText(customerEmail)}) Tj`);
  streamLines.push('ET');

  // Right Column: Order Details
  streamLines.push('BT');
  streamLines.push('/F1 8.5 Tf');
  streamLines.push('0.28 0.35 0.44 rg');
  streamLines.push(`320 ${metaY - 16} Td`);
  streamLines.push(`(Invoice Date: ${escapePdfText(invoiceDate)}) Tj`);
  streamLines.push('ET');

  streamLines.push('BT');
  streamLines.push('/F1 8.5 Tf');
  streamLines.push('0.28 0.35 0.44 rg');
  streamLines.push(`320 ${metaY - 29} Td`);
  streamLines.push(`(Order Ref: #${escapePdfText(orderNumber)}) Tj`);
  streamLines.push('ET');

  streamLines.push('BT');
  streamLines.push('/F1 8 Tf');
  streamLines.push('0.28 0.35 0.44 rg');
  streamLines.push(`320 ${metaY - 42} Td`);
  streamLines.push(`(Payment: ${escapePdfText(paymentMethod)} | Txn: ${escapePdfText(transactionId.substring(0, 16))}) Tj`);
  streamLines.push('ET');

  streamLines.push('BT');
  streamLines.push('/F1 7.5 Tf');
  streamLines.push('0.45 0.50 0.58 rg');
  streamLines.push(`320 ${metaY - 54} Td`);
  streamLines.push(`(Place of Supply: ${escapePdfText(financial.placeOfSupply || config.defaultPlaceOfSupply || 'Karnataka (29)')}) Tj`);
  streamLines.push('ET');

  // 4. Items Table Header
  let tableY = metaY - metaBoxHeight - 20;
  streamLines.push('q');
  streamLines.push('0.10 0.14 0.20 rg'); // #1a2332 dark header
  streamLines.push(`40 ${tableY} ${width - 80} 22 re f`);
  streamLines.push('Q');

  streamLines.push('BT');
  streamLines.push('/F2 8.5 Tf');
  streamLines.push('1 1 1 rg');
  streamLines.push(`50 ${tableY + 6} Td`);
  streamLines.push('(ITEM & DIGITAL ACCESS DETAILS) Tj');
  streamLines.push(`260 0 Td`);
  streamLines.push('(HSN/SAC) Tj');
  streamLines.push(`55 0 Td`);
  streamLines.push('(QTY) Tj');
  streamLines.push(`45 0 Td`);
  streamLines.push('(UNIT PRICE) Tj');
  streamLines.push(`55 0 Td`);
  streamLines.push('(TOTAL) Tj');
  streamLines.push('ET');

  tableY -= 4; // gap between header and first row

  // 5. Items Rendering with Product Access Links & License Key Previews
  const items = invoice.items || [];
  const clientUrl = config.websiteUrl || 'https://bundlebyte.com';
  const defaultVaultUrl = `${clientUrl}/dashboard/vault`;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const isEven = i % 2 === 0;

    const accessLinkUrl = item.productAccessLink || item.vaultUrl || defaultVaultUrl;
    const guideUrl = item.setupGuideUrl || '';
    const licenseKey = item.licenseKey || '';
    const hasAccessInfo = config.showAccessLinks;

    // Calculate row height dynamically
    // Main item line = 20pt, Access Box = 28pt, Key Preview = 16pt
    let rowHeight = 24;
    if (hasAccessInfo) {
      rowHeight += 28;
      if (licenseKey && config.showLicenseKeyPreview) {
        rowHeight += 16;
      }
    }

    const rowTop = tableY;
    const rowBottom = rowTop - rowHeight;

    // Row Background
    streamLines.push('q');
    if (isEven) {
      streamLines.push('0.98 0.98 0.99 rg');
    } else {
      streamLines.push('1 1 1 rg');
    }
    streamLines.push('0.90 0.92 0.95 RG');
    streamLines.push(`40 ${rowBottom} ${width - 80} ${rowHeight} re B`);
    streamLines.push('Q');

    const title = escapePdfText(item.productTitle || 'Digital License Product').substring(0, 40);
    const duration = escapePdfText(item.duration || 'Annual');
    const hsnSac = config.showHsnSac ? (item.hsnSac || '998434') : '-';
    const qty = String(item.quantity || 1);
    const unitPrice = `${currencySymbol} ${(item.unitPrice || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    const lineTotal = `${currencySymbol} ${(item.totalPrice || item.unitPrice * (item.quantity || 1) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

    // Line 1: Title, HSN, Qty, Price, Total
    streamLines.push('BT');
    streamLines.push('/F2 9 Tf');
    streamLines.push('0.06 0.09 0.16 rg');
    streamLines.push(`50 ${rowTop - 14} Td`);
    streamLines.push(`(${title} [${duration}]) Tj`);
    streamLines.push('ET');

    streamLines.push('BT');
    streamLines.push('/F1 8 Tf');
    streamLines.push('0.38 0.44 0.53 rg');
    streamLines.push(`310 ${rowTop - 14} Td`);
    streamLines.push(`(${escapePdfText(hsnSac)}) Tj`);
    streamLines.push(`55 0 Td`);
    streamLines.push(`(${qty}) Tj`);
    streamLines.push(`45 0 Td`);
    streamLines.push(`(${unitPrice}) Tj`);
    streamLines.push('ET');

    streamLines.push('BT');
    streamLines.push('/F2 9 Tf');
    streamLines.push('0.06 0.09 0.16 rg');
    streamLines.push(`510 ${rowTop - 14} Td`);
    streamLines.push(`(${lineTotal}) Tj`);
    streamLines.push('ET');

    // Line 2: Access Link Box & Vault Link
    if (hasAccessInfo) {
      const boxY = rowTop - 42;
      const boxWidth = 240;
      const boxHeight = 20;

      // Access button background
      streamLines.push('q');
      streamLines.push(`${accentR} ${accentG} ${accentB} rg`);
      streamLines.push(`50 ${boxY} ${boxWidth} ${boxHeight} re f`);
      streamLines.push('Q');

      // Access button text
      const btnLabel = (config.accessButtonLabel || 'Access Product & Vault').toUpperCase();
      streamLines.push('BT');
      streamLines.push('/F2 8 Tf');
      streamLines.push('1 1 1 rg');
      streamLines.push(`58 ${boxY + 6} Td`);
      streamLines.push(`(-> ${escapePdfText(btnLabel)}) Tj`);
      streamLines.push('ET');

      // Add clickable PDF link annotation for the button
      addLink(50, boxY, 50 + boxWidth, boxY + boxHeight, accessLinkUrl);

      // Setup Guide Link if present
      if (guideUrl) {
        const guideX = 50 + boxWidth + 10;
        const guideW = 85;
        streamLines.push('q');
        streamLines.push('0.92 0.94 0.98 rg');
        streamLines.push('0.75 0.80 0.92 RG');
        streamLines.push(`${guideX} ${boxY} ${guideW} ${boxHeight} re B`);
        streamLines.push('Q');

        streamLines.push('BT');
        streamLines.push('/F2 7.5 Tf');
        streamLines.push(`${accentR} ${accentG} ${accentB} rg`);
        streamLines.push(`${guideX + 6} ${boxY + 6} Td`);
        streamLines.push('(Setup Guide) Tj');
        streamLines.push('ET');

        addLink(guideX, boxY, guideX + guideW, boxY + boxHeight, guideUrl);
      }

      // Vault URL text on right side
      streamLines.push('BT');
      streamLines.push('/F1 7 Tf');
      streamLines.push('0.40 0.46 0.56 rg');
      streamLines.push(`390 ${boxY + 6} Td`);
      streamLines.push(`(Secure Vault: ${escapePdfText(clientUrl)}/dashboard/vault) Tj`);
      streamLines.push('ET');

      addLink(390, boxY, 540, boxY + 12, defaultVaultUrl);

      // Line 3: License Key Preview (if allocated)
      if (licenseKey && config.showLicenseKeyPreview) {
        const keyY = boxY - 14;
        const maskedKey =
          licenseKey.length > 8
            ? licenseKey.substring(0, 4) + '-XXXX-' + licenseKey.substring(licenseKey.length - 4)
            : licenseKey;

        streamLines.push('BT');
        streamLines.push('/F2 7.5 Tf');
        streamLines.push('0.15 0.20 0.28 rg');
        streamLines.push(`50 ${keyY} Td`);
        streamLines.push(`(License Key: ) Tj`);
        streamLines.push('/F1 7.5 Tf');
        streamLines.push('0.31 0.27 0.90 rg');
        streamLines.push(`(${escapePdfText(maskedKey)}) Tj`);
        streamLines.push('/F1 7 Tf');
        streamLines.push('0.50 0.55 0.65 rg');
        streamLines.push(`( [Encrypted in Vault]) Tj`);
        streamLines.push('ET');
      }
    }

    tableY -= rowHeight;
  }

  // Divider line after all items
  streamLines.push('q');
  streamLines.push('0.85 0.88 0.92 RG');
  streamLines.push(`40 ${tableY} m ${width - 40} ${tableY} l S`);
  streamLines.push('Q');

  // 6. Summary Card (Right Side) & Terms/Authenticity (Left Side)
  const summaryTop = tableY - 12;
  const summaryLeft = 310;
  const summaryWidth = width - 40 - summaryLeft;

  const isIntraState = financial.isIntraState !== undefined ? financial.isIntraState : true;
  const cgstVal = (financial.taxBreakdown?.cgst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
  const sgstVal = (financial.taxBreakdown?.sgst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
  const igstVal = (financial.taxBreakdown?.igst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
  const taxableVal = (
    financial.taxableAmount || (financial.subtotal - (financial.discount || 0))
  ).toLocaleString('en-IN', { minimumFractionDigits: 2 });
  const custSurcharge = financial.gatewayFeeDetails?.customerSurcharge || financial.additionalCharges || 0;

  const showGst = config.showGstBreakdown;
  let summaryRowsCount = 3; // subtotal, taxable, total
  if (financial.discount > 0 || financial.couponDiscount > 0) summaryRowsCount += 1;
  if (showGst) summaryRowsCount += isIntraState ? 2 : 1;
  if (custSurcharge > 0) summaryRowsCount += 1;

  const cardHeight = Math.max(115, summaryRowsCount * 17 + 25);

  // Summary Card background & border
  streamLines.push('q');
  streamLines.push('0.97 0.98 0.99 rg');
  streamLines.push('0.85 0.88 0.92 RG');
  streamLines.push(`${summaryLeft} ${summaryTop - cardHeight} ${summaryWidth} ${cardHeight} re B`);
  streamLines.push('Q');

  const printSummaryRow = (label, value, yOffset, isBold = false, isAccent = false) => {
    streamLines.push('BT');
    streamLines.push(isBold ? '/F2 8.5 Tf' : '/F1 8.5 Tf');
    streamLines.push(isAccent ? `${accentR} ${accentG} ${accentB} rg` : '0.28 0.35 0.44 rg');
    streamLines.push(`${summaryLeft + 12} ${summaryTop - yOffset} Td`);
    streamLines.push(`(${label}) Tj`);
    streamLines.push('ET');

    streamLines.push('BT');
    streamLines.push(isBold ? '/F2 8.5 Tf' : '/F1 8.5 Tf');
    streamLines.push(isAccent ? `${accentR} ${accentG} ${accentB} rg` : '0.06 0.09 0.16 rg');
    streamLines.push(`${summaryLeft + summaryWidth - 75} ${summaryTop - yOffset} Td`);
    streamLines.push(`(${value}) Tj`);
    streamLines.push('ET');
  };

  let rowY = 16;
  printSummaryRow('Subtotal:', `${currencySymbol} ${subtotal}`, rowY);

  if (financial.discount > 0 || financial.couponDiscount > 0) {
    rowY += 15;
    printSummaryRow('Discount:', `-${currencySymbol} ${discount}`, rowY);
  }

  rowY += 15;
  printSummaryRow('Taxable Value:', `${currencySymbol} ${taxableVal}`, rowY);

  if (showGst) {
    if (isIntraState) {
      rowY += 15;
      printSummaryRow('CGST (9%):', `${currencySymbol} ${cgstVal}`, rowY);
      rowY += 15;
      printSummaryRow('SGST (9%):', `${currencySymbol} ${sgstVal}`, rowY);
    } else {
      rowY += 15;
      printSummaryRow('IGST (18%):', `${currencySymbol} ${igstVal}`, rowY);
    }
  }

  if (custSurcharge > 0) {
    rowY += 15;
    printSummaryRow(
      'Gateway Fee & GST:',
      `+${currencySymbol} ${custSurcharge.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      rowY
    );
  }

  // Divider line before Grand Total
  rowY += 8;
  streamLines.push('q');
  streamLines.push('0.85 0.88 0.92 RG');
  streamLines.push(`${summaryLeft} ${summaryTop - rowY} m ${summaryLeft + summaryWidth} ${summaryTop - rowY} l S`);
  streamLines.push('Q');

  rowY += 14;
  printSummaryRow('Final Amount Paid:', `${currencySymbol} ${totalAmount}`, rowY, true, true);

  // Left Column: Terms & Security Authenticity Note
  const termsLeft = 40;
  const termsWidth = summaryLeft - termsLeft - 15;

  streamLines.push('BT');
  streamLines.push('/F2 8 Tf');
  streamLines.push('0.28 0.35 0.44 rg');
  streamLines.push(`${termsLeft} ${summaryTop - 12} Td`);
  streamLines.push('(TERMS & CONDITIONS:) Tj');
  streamLines.push('ET');

  const termsLines = (config.termsText || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  let termY = summaryTop - 25;
  for (let t = 0; t < Math.min(termsLines.length, 4); t++) {
    streamLines.push('BT');
    streamLines.push('/F1 7.5 Tf');
    streamLines.push('0.42 0.48 0.58 rg');
    streamLines.push(`${termsLeft} ${termY} Td`);
    streamLines.push(`(${escapePdfText(termsLines[t]).substring(0, 68)}) Tj`);
    streamLines.push('ET');
    termY -= 12;
  }

  // Authenticity & Verification Token
  termY -= 4;
  streamLines.push('BT');
  streamLines.push('/F2 7.5 Tf');
  streamLines.push(`${accentR} ${accentG} ${accentB} rg`);
  streamLines.push(`${termsLeft} ${termY} Td`);
  streamLines.push(`(Verification ID: BB-TAX-${invoiceNumber.replace(/[^0-9]/g, '')}-${orderNumber}) Tj`);
  streamLines.push('ET');

  // 7. Footer Bar (Company contact & Registered address)
  streamLines.push('q');
  streamLines.push(`${secR} ${secG} ${secB} rg`);
  streamLines.push(`0 0 ${width} 42 re f`);
  streamLines.push('Q');

  streamLines.push('BT');
  streamLines.push('/F1 7.5 Tf');
  streamLines.push('0.60 0.66 0.75 rg');
  streamLines.push(`40 24 Td`);
  streamLines.push(`(${escapePdfText(companyName)} | ${escapePdfText(businessAddress).substring(0, 80)}) Tj`);
  streamLines.push('ET');

  streamLines.push('BT');
  streamLines.push('/F1 7.5 Tf');
  streamLines.push('0.60 0.66 0.75 rg');
  streamLines.push(`40 12 Td`);
  streamLines.push(`(Concierge: ${escapePdfText(businessEmail)} | Phone: ${escapePdfText(businessPhone)} | ${escapePdfText(websiteUrl)}) Tj`);
  streamLines.push('ET');

  addLink(40, 8, 400, 22, websiteUrl);

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

  // Obj 3: Page (with clickable interactive link annotations if any)
  const annotsStr =
    linkAnnotations.length > 0 ? ` /Annots [\n${linkAnnotations.join('\n')}\n]` : '';

  addObj(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >>${annotsStr} /Contents 4 0 R >>\nendobj`
  );

  // Obj 4: Content stream
  addObj(`4 0 obj\n<< /Length ${streamLength} >>\nstream\n${contentStream}\nendstream\nendobj`);

  // Obj 5: Font F1 (Helvetica)
  addObj(`5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj`);

  // Obj 6: Font F2 (Helvetica-Bold)
  addObj(`6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj`);

  // Calculate byte offsets
  const header = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
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
