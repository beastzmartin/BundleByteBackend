import LicenseInventory from '../models/LicenseInventory.js';
import Product from '../models/Product.js';

/**
 * Parse CSV or plain text string into array of key inventory items
 * Format can be:
 * 1) Simple text: one license key per line
 * 2) CSV: licenseKey,username,password,accessLink,expiryDate
 * 3) CSV with headers
 */
export const parseKeysContent = (fileContent) => {
  if (!fileContent || typeof fileContent !== 'string') {
    return [];
  }

  const lines = fileContent
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));

  if (lines.length === 0) return [];

  // Check if first row is header
  const firstLine = lines[0].toLowerCase();
  const hasHeader =
    firstLine.includes('key') ||
    firstLine.includes('license') ||
    firstLine.includes('username');

  const startIndex = hasHeader ? 1 : 0;
  const parsedItems = [];

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];

    // Check if line is CSV separated by comma or tab or semicolon
    if (line.includes(',') || line.includes('\t') || line.includes(';')) {
      const delimiter = line.includes('\t') ? '\t' : line.includes(';') ? ';' : ',';
      const parts = line.split(delimiter).map((p) => p.trim().replace(/^["']|["']$/g, ''));

      const [licenseKey, username, password, accessLink, expiryDateStr] = parts;

      if (licenseKey) {
        let expiryDate = null;
        if (expiryDateStr) {
          const parsed = new Date(expiryDateStr);
          if (!isNaN(parsed.getTime())) {
            expiryDate = parsed;
          }
        }

        parsedItems.push({
          licenseKey,
          accountCredentials: {
            username: username || '',
            password: password || '',
            recoveryInfo: '',
          },
          accessLink: accessLink || '',
          expiryDate,
        });
      }
    } else {
      // Single key per line
      parsedItems.push({
        licenseKey: line,
        accountCredentials: { username: '', password: '', recoveryInfo: '' },
        accessLink: '',
        expiryDate: null,
      });
    }
  }

  return parsedItems;
};

/**
 * Bulk import license keys for a product
 */
export const importProductKeys = async ({
  productId,
  durationType = 'annual',
  fileContent,
  adminUser = null,
  batchTag = '',
}) => {
  const product = await Product.findById(productId);
  if (!product) {
    throw new Error('Product not found');
  }

  const items = parseKeysContent(fileContent);
  if (items.length === 0) {
    throw new Error('No valid license keys found in the provided content');
  }

  let importedCount = 0;
  let skippedCount = 0;
  const errors = [];

  for (const item of items) {
    try {
      // Check for duplicate key across inventory
      const existing = await LicenseInventory.findOne({
        product: productId,
        licenseKey: item.licenseKey,
      });

      if (existing) {
        skippedCount++;
        continue;
      }

      await LicenseInventory.create({
        product: productId,
        durationType,
        licenseKey: item.licenseKey,
        accountCredentials: item.accountCredentials,
        accessLink: item.accessLink || product.defaultAccessLink || '',
        status: 'Available',
        expiryDate: item.expiryDate || null,
        batchTag: batchTag || `IMPORT-${Date.now()}`,
        adminNotes: adminUser ? `Imported by ${adminUser.name || adminUser.email}` : 'Bulk imported',
      });

      importedCount++;
    } catch (err) {
      errors.push({ key: item.licenseKey, error: err.message });
    }
  }

  // Update product stock count if managed
  const totalAvailable = await LicenseInventory.countDocuments({
    product: productId,
    status: 'Available',
  });

  return {
    productId,
    productTitle: product.title,
    totalParsed: items.length,
    importedCount,
    skippedCount,
    totalAvailableStock: totalAvailable,
    errors,
  };
};

