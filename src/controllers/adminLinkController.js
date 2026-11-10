import SoftwareLinkInventory from '../models/SoftwareLinkInventory.js';
import Product from '../models/Product.js';
import { logAudit } from '../middleware/audit.js';

/**
 * GET /api/admin/inventory/links
 * List software access links with status, product, type filters & pagination
 */
export const getLinkInventory = async (req, res, next) => {
  try {
    const {
      status,
      linkType,
      productId: queryProductId,
      product: queryProduct,
      search,
      page = 1,
      limit = 20,
    } = req.query;

    const query = {};

    if (status && status !== 'all') {
      query.status = status;
    }

    if (linkType && linkType !== 'all') {
      query.linkType = linkType;
    }

    const productId = queryProductId || queryProduct;
    if (productId && productId !== 'all') {
      query.product = productId;
    }

    if (search && search.trim()) {
      query.$or = [
        { title: { $regex: search.trim(), $options: 'i' } },
        { url: { $regex: search.trim(), $options: 'i' } },
        { batchId: { $regex: search.trim(), $options: 'i' } },
        { installationInstructions: { $regex: search.trim(), $options: 'i' } },
      ];
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const skip = (pageNum - 1) * limitNum;

    const [links, total] = await Promise.all([
      SoftwareLinkInventory.find(query)
        .populate('product', 'title slug logo deliveryMethod')
        .populate('allocatedToUser', 'name email')
        .populate('allocatedToOrder', 'orderNumber')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      SoftwareLinkInventory.countDocuments(query),
    ]);

    // Aggregate counts by status
    const [availableCount, soldCount, reservedCount, disabledCount, expiredCount] =
      await Promise.all([
        SoftwareLinkInventory.countDocuments({ status: 'Available' }),
        SoftwareLinkInventory.countDocuments({ status: 'Sold' }),
        SoftwareLinkInventory.countDocuments({ status: 'Reserved' }),
        SoftwareLinkInventory.countDocuments({ status: 'Disabled' }),
        SoftwareLinkInventory.countDocuments({ status: 'Expired' }),
      ]);

    res.status(200).json({
      success: true,
      links,
      stats: {
        total,
        available: availableCount,
        sold: soldCount,
        reserved: reservedCount,
        disabled: disabledCount,
        expired: expiredCount,
      },
      pagination: {
        total,
        page: pageNum,
        pages: Math.ceil(total / limitNum) || 1,
        limit: limitNum,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/inventory/links
 * Add individual software access link
 */
export const addIndividualLink = async (req, res, next) => {
  try {
    const {
      productId: bodyProductId,
      product: bodyProduct,
      title,
      linkType = 'direct_download',
      url,
      backupUrl = '',
      installationInstructions,
      maxAccessCount = 0,
      expiryDate,
      status = 'Available',
      batchId = '',
      notes = '',
    } = req.body;

    const productId = bodyProductId || bodyProduct;

    if (!productId || !url) {
      return res.status(400).json({
        success: false,
        message: 'Product ID and destination URL are required',
      });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // Check duplicate URL for this product
    const existing = await SoftwareLinkInventory.findOne({
      product: productId,
      url: url.trim(),
    });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'This software link URL already exists for the selected product',
      });
    }

    const finalTitle = title?.trim() || `${product.title} Access Link`;
    const validLinkType = ['direct_download', 'activation_portal', 'workspace_invite', 'setup_guide', 'cloud_drive'].includes(linkType)
      ? linkType
      : 'direct_download';

    const link = await SoftwareLinkInventory.create({
      product: productId,
      title: finalTitle,
      linkType: validLinkType,
      url: url.trim(),
      backupUrl: backupUrl ? backupUrl.trim() : '',
      installationInstructions:
        installationInstructions?.trim() ||
        product.activationProcess ||
        product.deliveryInstructions ||
        'Follow the instructions to redeem or install your software.',
      maxAccessCount: Number(maxAccessCount) || 0,
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      status: ['Available', 'Reserved', 'Sold', 'Disabled', 'Expired'].includes(status) ? status : 'Available',
      batchId: batchId || `LINK-${Date.now().toString().slice(-4)}`,
      notes,
    });

    await logAudit({
      actor: req.user._id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: 'SOFTWARE_LINK_ADDED',
      entity: 'SoftwareLinkInventory',
      entityId: link._id.toString(),
      details: { productId, title: link.title, linkType: link.linkType },
      req,
    });

    res.status(201).json({
      success: true,
      message: 'Software access link created successfully',
      link,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/inventory/links/bulk-import
 * Bulk import software links from raw text, CSV, TSV or pipe-separated lines
 */
export const bulkImportLinks = async (req, res, next) => {
  try {
    const { productId: bodyProductId, product: bodyProduct, fileContent, defaultLinkType = 'direct_download', batchId } = req.body;
    const productId = bodyProductId || bodyProduct;

    if (!productId) {
      return res.status(400).json({ success: false, message: 'Product ID is required' });
    }

    if (!fileContent || !fileContent.trim()) {
      return res.status(400).json({ success: false, message: 'File or text content is required' });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const lines = fileContent
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith('#'));

    const effectiveBatch = batchId || `BATCH-LNK-${Date.now().toString().slice(-6)}`;
    const imported = [];
    const skipped = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Skip header row if matches common CSV headers
      if (i === 0 && (line.toLowerCase().includes('title,') || line.toLowerCase().includes('url,') || line.toLowerCase().includes('title|'))) {
        continue;
      }

      // Check delimiter
      let delimiter = ',';
      if (line.includes('|')) delimiter = '|';
      else if (line.includes('\t')) delimiter = '\t';

      const parts = line.split(delimiter).map((p) => p.trim().replace(/^["']|["']$/g, ''));
      let title = '';
      let url = '';
      let type = defaultLinkType;
      let instructions = product.activationProcess || product.deliveryInstructions || '';

      if (parts.length >= 2 && (parts[1].startsWith('http') || parts[1].startsWith('/'))) {
        title = parts[0];
        url = parts[1];
        if (parts[2]) type = parts[2];
        if (parts[3]) instructions = parts.slice(3).join(delimiter);
      } else if (parts[0].startsWith('http') || parts[0].startsWith('/')) {
        url = parts[0];
        title = parts[1] || `${product.title} Access Link ${i + 1}`;
      } else {
        title = parts[0];
        url = parts[1] || '';
      }

      if (!url) {
        skipped.push({ line, reason: 'Missing destination URL' });
        continue;
      }

      // Check duplicate
      const exists = await SoftwareLinkInventory.findOne({ product: productId, url });
      if (exists) {
        skipped.push({ line, reason: 'Duplicate URL already exists' });
        continue;
      }

      const doc = await SoftwareLinkInventory.create({
        product: productId,
        title: title || `${product.title} Access`,
        url,
        linkType: ['direct_download', 'activation_portal', 'workspace_invite', 'setup_guide', 'cloud_drive'].includes(type)
          ? type
          : defaultLinkType,
        installationInstructions: instructions,
        status: 'Available',
        batchId: effectiveBatch,
      });

      imported.push(doc);
    }

    await logAudit({
      actor: req.user._id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: 'SOFTWARE_LINKS_BULK_IMPORTED',
      entity: 'SoftwareLinkInventory',
      entityId: productId,
      details: {
        totalLines: lines.length,
        importedCount: imported.length,
        skippedCount: skipped.length,
        batchId: effectiveBatch,
      },
      req,
    });

    res.status(200).json({
      success: true,
      message: `Imported ${imported.length} links successfully (${skipped.length} skipped).`,
      importedCount: imported.length,
      skippedCount: skipped.length,
      skipped,
      batchId: effectiveBatch,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/admin/inventory/links/:id
 * Update software link properties or status
 */
export const updateLink = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      title,
      linkType,
      url,
      backupUrl,
      installationInstructions,
      maxAccessCount,
      expiryDate,
      status,
      notes,
    } = req.body;

    const link = await SoftwareLinkInventory.findById(id);
    if (!link) {
      return res.status(404).json({ success: false, message: 'Software link not found' });
    }

    if (title) link.title = title.trim();
    if (linkType) link.linkType = linkType;
    if (url) link.url = url.trim();
    if (backupUrl !== undefined) link.backupUrl = backupUrl.trim();
    if (installationInstructions !== undefined) link.installationInstructions = installationInstructions;
    if (maxAccessCount !== undefined) link.maxAccessCount = Number(maxAccessCount);
    if (expiryDate !== undefined) link.expiryDate = expiryDate ? new Date(expiryDate) : null;
    if (status) link.status = status;
    if (notes !== undefined) link.notes = notes;

    await link.save();

    await logAudit({
      actor: req.user._id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: 'SOFTWARE_LINK_UPDATED',
      entity: 'SoftwareLinkInventory',
      entityId: link._id.toString(),
      details: { title: link.title, status: link.status },
      req,
    });

    res.status(200).json({
      success: true,
      message: 'Software access link updated',
      link,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/admin/inventory/links/:id
 * Delete or disable a software link
 */
export const deleteLink = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { permanent = false } = req.query;

    const link = await SoftwareLinkInventory.findById(id);
    if (!link) {
      return res.status(404).json({ success: false, message: 'Software link not found' });
    }

    if (permanent === 'true' || permanent === true) {
      if (link.status === 'Sold') {
        return res.status(400).json({
          success: false,
          message: 'Cannot permanently delete an already fulfilled/sold link. Please set status to Disabled instead.',
        });
      }
      await SoftwareLinkInventory.findByIdAndDelete(id);
    } else {
      link.status = 'Disabled';
      await link.save();
    }

    await logAudit({
      actor: req.user._id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: 'SOFTWARE_LINK_DELETED',
      entity: 'SoftwareLinkInventory',
      entityId: id,
      details: { permanent },
      req,
    });

    res.status(200).json({
      success: true,
      message: permanent ? 'Software link permanently removed' : 'Software link disabled',
    });
  } catch (error) {
    next(error);
  }
};
