import AccountInventory from '../models/AccountInventory.js';
import AccountImportBatch from '../models/AccountImportBatch.js';
import AccountDelivery from '../models/AccountDelivery.js';
import Product from '../models/Product.js';
import { encryptCredential, decryptCredential } from '../utils/credentialEncryption.js';

/**
 * Standardize and parse raw lines from text / CSV / paste into account records
 * Supported formats:
 * 1. Label-based: USERNAME: xxx PASSWORD: yyy ACCOUNT_TYPE: zzz PLAN: aaa EXPIRES_AT: bbb LOGIN_URL: ccc NOTES: ddd
 * 2. Delimiter-based: user:pass, user|pass, user,pass
 * 3. CSV with headers
 */
export const parseRawAccountLines = (content, customDelimiter = null) => {
  if (!content || typeof content !== 'string') return [];

  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));

  const parsed = [];

  for (let idx = 0; idx < lines.length; idx++) {
    const rawLine = lines[idx];
    const lineNum = idx + 1;

    // Check if line contains labeled tags (e.g. USERNAME: ... PASSWORD: ...)
    const upper = rawLine.toUpperCase();
    if (upper.includes('USERNAME:') && upper.includes('PASSWORD:')) {
      const getField = (fieldName) => {
        const regex = new RegExp(`${fieldName}:\\s*([^\\s]+(?:\\s+[^\\s]+)*?)(?=\\s+[A-Z_]+:|$)`, 'i');
        const match = rawLine.match(regex);
        return match ? match[1].trim() : '';
      };

      const username = getField('USERNAME');
      const password = getField('PASSWORD');
      const accountType = getField('ACCOUNT_TYPE') || 'Premium';
      const plan = getField('PLAN') || 'Annual';
      const loginUrl = getField('LOGIN_URL');
      const notes = getField('NOTES');
      const expiresAtStr = getField('EXPIRES_AT');

      let expiresAt = null;
      if (expiresAtStr) {
        const d = new Date(expiresAtStr);
        if (!isNaN(d.getTime())) expiresAt = d;
      }

      parsed.push({
        lineNum,
        raw: rawLine,
        username,
        password,
        accountType,
        plan,
        loginUrl,
        notes,
        expiresAt,
      });
      continue;
    }

    // Determine delimiter (: or | or , or \t)
    let delimiter = customDelimiter;
    if (!delimiter) {
      if (rawLine.includes('|')) delimiter = '|';
      else if (rawLine.includes(',')) delimiter = ',';
      else if (rawLine.includes('\t')) delimiter = '\t';
      else delimiter = ':';
    }

    const parts = rawLine.split(delimiter).map((p) => p.trim().replace(/^["']|["']$/g, ''));
    const [username, password, accountType, plan, loginUrl, expiresAtStr, notes] = parts;

    let expiresAt = null;
    if (expiresAtStr) {
      const d = new Date(expiresAtStr);
      if (!isNaN(d.getTime())) expiresAt = d;
    }

    parsed.push({
      lineNum,
      raw: rawLine,
      username: username || '',
      password: password || '',
      accountType: accountType || 'Premium',
      plan: plan || 'Annual',
      loginUrl: loginUrl || '',
      notes: notes || '',
      expiresAt,
    });
  }

  return parsed;
};

/**
 * Preview bulk account import
 * Returns counts of total detected, valid, duplicate, invalid
 */
export const previewAccountImport = async ({ productId, content, delimiter = null }) => {
  const product = await Product.findById(productId);
  if (!product) throw new Error('Product not found');

  const parsedItems = parseRawAccountLines(content, delimiter);

  const validAccounts = [];
  const duplicateAccounts = [];
  const invalidRecords = [];

  const existingAccounts = await AccountInventory.find({ product: productId }).select('username');
  const existingUsernames = new Set(existingAccounts.map((a) => a.username.toLowerCase()));
  const batchSeenUsernames = new Set();

  for (const item of parsedItems) {
    // Validation checks
    if (!item.username || !item.username.trim()) {
      invalidRecords.push({ line: item.lineNum, raw: item.raw, reason: 'Missing username or email' });
      continue;
    }
    if (!item.password || !item.password.trim()) {
      invalidRecords.push({ line: item.lineNum, raw: item.raw, reason: 'Missing account password' });
      continue;
    }

    // Check expiry
    if (item.expiresAt && item.expiresAt < new Date()) {
      invalidRecords.push({ line: item.lineNum, raw: item.raw, reason: 'Account expiry date is in the past' });
      continue;
    }

    const lowerUser = item.username.toLowerCase();

    // Check duplicate in database or in current batch
    if (existingUsernames.has(lowerUser) || batchSeenUsernames.has(lowerUser)) {
      duplicateAccounts.push({ line: item.lineNum, username: item.username, raw: item.raw });
      continue;
    }

    batchSeenUsernames.add(lowerUser);
    validAccounts.push(item);
  }

  return {
    productId,
    productTitle: product.title,
    totalDetected: parsedItems.length,
    validCount: validAccounts.length,
    duplicateCount: duplicateAccounts.length,
    invalidCount: invalidRecords.length,
    validAccounts,
    duplicateAccounts,
    invalidRecords,
  };
};

/**
 * Commit bulk account import with AES-256 authenticated encryption
 */
export const commitAccountImport = async ({
  productId,
  accounts = [],
  importedBy,
  fileName = 'bulk-import',
  sourceType = 'paste',
  batchTag = '',
}) => {
  const product = await Product.findById(productId);
  if (!product) throw new Error('Product not found');

  const batch = await AccountImportBatch.create({
    product: productId,
    importedBy: importedBy._id || importedBy,
    fileName,
    sourceType,
    totalDetected: accounts.length,
    validCount: accounts.length,
    duplicateCount: 0,
    invalidCount: 0,
    status: 'completed',
    summaryNotes: `Imported ${accounts.length} valid accounts into inventory.`,
  });

  const docsToInsert = accounts.map((acc) => ({
    product: productId,
    username: acc.username.trim(),
    encryptedPassword: encryptCredential(acc.password.trim()),
    accountType: acc.accountType || 'Premium',
    plan: acc.plan || 'Annual',
    loginUrl: acc.loginUrl || product.accessLink || product.defaultAccessLink || '',
    expiresAt: acc.expiresAt || null,
    notes: acc.notes || '',
    status: 'Available',
    batchId: batch._id,
    batchTag: batchTag || `BATCH-${Date.now().toString(36).toUpperCase()}`,
  }));

  const inserted = await AccountInventory.insertMany(docsToInsert);

  return {
    batchId: batch._id,
    importedCount: inserted.length,
    productTitle: product.title,
  };
};

/**
 * Atomically allocate an available account for a product during order processing
 */
export const allocateAccountAtomically = async ({ productId, orderId, userId }) => {
  // Find an available account and atomically mark as Sold
  const account = await AccountInventory.findOneAndUpdate(
    {
      product: productId,
      status: 'Available',
    },
    {
      $set: {
        status: 'Sold',
        allocatedToOrder: orderId,
        allocatedToUser: userId,
        allocatedAt: new Date(),
      },
    },
    { new: true }
  );

  if (!account) return null;

  // Create AccountDelivery record
  const delivery = await AccountDelivery.create({
    account: account._id,
    order: orderId,
    user: userId,
    product: productId,
    deliveredUsername: account.username,
    encryptedPassword: account.encryptedPassword,
    loginUrl: account.loginUrl,
    accountType: account.accountType,
    plan: account.plan,
    notes: account.notes,
    deliveredAt: new Date(),
  });

  return {
    account,
    delivery,
    decryptedPassword: account.getDecryptedPassword(),
  };
};

