import TaxConfiguration, { INDIAN_STATES_AND_CODES } from '../models/TaxConfiguration.js';
import TaxCategory from '../models/TaxCategory.js';
import GatewayFeeConfig from '../models/GatewayFeeConfig.js';
import TaxAuditLog from '../models/TaxAuditLog.js';
import Order from '../models/Order.js';
import Refund from '../models/Refund.js';
import taxFeeEngine, { round2, DEFAULT_GATEWAY_CONFIGS } from '../services/taxFeeEngine.js';

/**
 * GET /api/tax/config
 * Retrieve active GST Tax Configuration
 */
export const getTaxConfig = async (req, res, next) => {
  try {
    const config = await taxFeeEngine.getTaxConfiguration();
    res.status(200).json({
      success: true,
      config,
      states: INDIAN_STATES_AND_CODES,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/tax/config
 * Update GST Tax Configuration (Admin only)
 */
export const updateTaxConfig = async (req, res, next) => {
  try {
    let config = await taxFeeEngine.getTaxConfiguration();
    const previous = config.toObject();

    const allowedFields = [
      'isGstEnabled',
      'businessLegalName',
      'tradeName',
      'gstin',
      'panNumber',
      'registeredAddress',
      'businessState',
      'businessStateCode',
      'defaultGstRate',
      'taxCalculationMode',
      'defaultHsnSacCode',
      'isCompositionScheme',
      'roundingRule',
      'invoicePrefix',
      'creditNotePrefix',
      'taxDisclosureNote',
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        config[field] = req.body[field];
      }
    });

    config.updatedBy = req.user._id;
    config.effectiveFrom = new Date();
    await config.save();

    // Log in TaxAuditLog
    await TaxAuditLog.create({
      actor: req.user._id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: 'TAX_CONFIG_UPDATED',
      entityType: 'TaxConfiguration',
      entityId: config._id.toString(),
      previousValues: previous,
      newValues: config.toObject(),
      reason: req.body.reason || 'Admin updated platform GST settings',
      ipAddress: req.ip || '',
    });

    res.status(200).json({
      success: true,
      message: 'GST Tax configuration updated successfully',
      config,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/tax/categories
 * List all GST Tax Categories & HSN classifications
 */
export const getTaxCategories = async (req, res, next) => {
  try {
    let categories = await TaxCategory.find().sort({ gstRate: 1 });

    if (categories.length === 0) {
      // Seed default categories
      categories = await TaxCategory.create([
        {
          name: 'Software Licenses & Digital Downloads',
          code: 'DIGITAL_SOFTWARE',
          hsnSacCode: '998434',
          gstRate: 18,
          description: 'Online software distribution, license keys, and cloud subscription access',
          isSystem: true,
        },
        {
          name: 'IT Technical Support & Concierge',
          code: 'IT_SUPPORT',
          hsnSacCode: '998313',
          gstRate: 18,
          description: 'Information technology consulting and concierge assistance',
          isSystem: true,
        },
        {
          name: 'Online Education & E-Books',
          code: 'E_LEARNING',
          hsnSacCode: '998431',
          gstRate: 5,
          description: 'Educational material, guides, and tutorials',
          isSystem: false,
        },
        {
          name: 'Zero-Rated / Exempt Digital Assets',
          code: 'EXEMPT_ASSETS',
          hsnSacCode: '998439',
          gstRate: 0,
          isExempt: true,
          exemptionReason: 'Notification No. 12/2017 - Central Tax (Rate)',
          description: 'Statutory exempted digital supplies',
          isSystem: false,
        },
      ]);
    }

    res.status(200).json({
      success: true,
      categories,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/tax/categories
 * Create new Tax Category
 */
export const createTaxCategory = async (req, res, next) => {
  try {
    const { name, code, hsnSacCode, gstRate, description, isExempt, exemptionReason } = req.body;

    const existing = await TaxCategory.findOne({ code: code.toUpperCase().trim() });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Tax category with this code already exists' });
    }

    const category = await TaxCategory.create({
      name,
      code: code.toUpperCase().trim(),
      hsnSacCode: hsnSacCode || '998434',
      gstRate: Number(gstRate) || 18,
      description: description || '',
      isExempt: Boolean(isExempt),
      exemptionReason: exemptionReason || '',
    });

    await TaxAuditLog.create({
      actor: req.user._id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: 'TAX_CATEGORY_CREATED',
      entityType: 'TaxCategory',
      entityId: category._id.toString(),
      newValues: category.toObject(),
      reason: 'Admin added new tax category',
      ipAddress: req.ip || '',
    });

    res.status(201).json({
      success: true,
      message: 'Tax category created successfully',
      category,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/tax/categories/:id
 * Update Tax Category
 */
export const updateTaxCategory = async (req, res, next) => {
  try {
    const category = await TaxCategory.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Tax category not found' });
    }

    const previous = category.toObject();
    const { name, hsnSacCode, gstRate, description, isExempt, exemptionReason, isActive } = req.body;

    if (name) category.name = name;
    if (hsnSacCode) category.hsnSacCode = hsnSacCode;
    if (gstRate !== undefined) category.gstRate = Number(gstRate);
    if (description !== undefined) category.description = description;
    if (isExempt !== undefined) category.isExempt = Boolean(isExempt);
    if (exemptionReason !== undefined) category.exemptionReason = exemptionReason;
    if (isActive !== undefined) category.isActive = Boolean(isActive);

    await category.save();

    await TaxAuditLog.create({
      actor: req.user._id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: 'TAX_CATEGORY_UPDATED',
      entityType: 'TaxCategory',
      entityId: category._id.toString(),
      previousValues: previous,
      newValues: category.toObject(),
      reason: 'Admin modified tax category',
      ipAddress: req.ip || '',
    });

    res.status(200).json({
      success: true,
      message: 'Tax category updated successfully',
      category,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/tax/categories/:id
 * Delete non-system Tax Category
 */
export const deleteTaxCategory = async (req, res, next) => {
  try {
    const category = await TaxCategory.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Tax category not found' });
    }
    if (category.isSystem) {
      return res.status(400).json({ success: false, message: 'System default tax categories cannot be deleted' });
    }

    await category.deleteOne();

    await TaxAuditLog.create({
      actor: req.user._id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: 'TAX_CATEGORY_DELETED',
      entityType: 'TaxCategory',
      entityId: req.params.id,
      previousValues: category.toObject(),
      reason: 'Admin deleted tax category',
      ipAddress: req.ip || '',
    });

    res.status(200).json({
      success: true,
      message: 'Tax category removed',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/tax/gateway-fees
 * List all Payment Gateway Fee Configurations
 */
export const getGatewayFeeConfigs = async (req, res, next) => {
  try {
    let configs = await GatewayFeeConfig.find().sort({ gatewayKey: 1 });

    if (configs.length === 0) {
      // Seed all default gateway fee presets
      for (const tpl of DEFAULT_GATEWAY_CONFIGS) {
        await GatewayFeeConfig.create(tpl);
      }
      configs = await GatewayFeeConfig.find().sort({ gatewayKey: 1 });
    }

    res.status(200).json({
      success: true,
      configs,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/tax/gateway-fees/:key
 * Update fee configuration for a specific gateway
 */
export const updateGatewayFeeConfig = async (req, res, next) => {
  try {
    const gatewayKey = req.params.key.toLowerCase().trim();
    let feeConfig = await GatewayFeeConfig.findOne({ gatewayKey });

    if (!feeConfig) {
      feeConfig = new GatewayFeeConfig({ gatewayKey, gatewayName: req.body.gatewayName || gatewayKey.toUpperCase() });
    }

    const previous = feeConfig.toObject();

    const allowed = [
      'gatewayName',
      'isEnabled',
      'feeType',
      'percentageFee',
      'fixedFee',
      'minFee',
      'maxFee',
      'feeGstRate',
      'feePayer',
      'methodFees',
      'currency',
      'minTransactionAmount',
      'maxTransactionAmount',
      'roundingRule',
      'notes',
    ];

    allowed.forEach((k) => {
      if (req.body[k] !== undefined) {
        feeConfig[k] = req.body[k];
      }
    });

    feeConfig.updatedBy = req.user._id;
    feeConfig.effectiveFrom = new Date();
    await feeConfig.save();

    await TaxAuditLog.create({
      actor: req.user._id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: 'GATEWAY_FEE_MODIFIED',
      entityType: 'GatewayFeeConfig',
      entityId: feeConfig._id.toString(),
      previousValues: previous,
      newValues: feeConfig.toObject(),
      reason: req.body.reason || `Updated fee rules for ${feeConfig.gatewayName}`,
      ipAddress: req.ip || '',
    });

    res.status(200).json({
      success: true,
      message: `Gateway fee rules for ${feeConfig.gatewayName} saved successfully`,
      feeConfig,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/tax/calculate-quote
 * Real-time server-side tax & gateway fee calculator for Cart & Checkout
 */
export const calculateQuote = async (req, res, next) => {
  try {
    const { items, customerState, paymentGateway = 'paytm', paymentMethodType = 'all', discount = 0 } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Cart items required for quote calculation' });
    }

    const quote = await taxFeeEngine.calculateCheckoutQuote({
      items,
      customerState,
      paymentGateway,
      paymentMethodType,
      discount: Number(discount) || 0,
      customerCurrency: req.body.customerCurrency || 'INR',
    });

    res.status(200).json({
      success: true,
      quote,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/tax/reports
 * Comprehensive GST Tax & Gateway Fee Ledger Analytics
 */
export const getFinancialGstReports = async (req, res, next) => {
  try {
    const { startDate, endDate, gateway, state, status = 'paid' } = req.query;

    const query = {};

    if (status === 'all') {
      query.paymentStatus = { $in: ['paid', 'refunded'] };
    } else {
      query.paymentStatus = status;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(new Date(endDate).setHours(23, 59, 59, 999));
    }

    if (gateway && gateway !== 'all') {
      query.paymentMethod = gateway;
    }

    if (state && state !== 'all') {
      query.$or = [
        { 'taxDetails.customerState': state },
        { 'billingAddress.state': state },
      ];
    }

    const orders = await Order.find(query)
      .select('orderNumber createdAt totalAmount subtotal discount taxAmount taxDetails gatewayFeeDetails paymentMethod paymentStatus customerName customerEmail')
      .sort({ createdAt: -1 })
      .limit(1000);

    let totalTaxableSales = 0;
    let totalGstCollected = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;
    let totalGatewayFeesIncurred = 0;
    let gatewayFeesAbsorbedByMerchant = 0;
    let gatewayFeesChargedToCustomers = 0;
    let grossTotalRevenue = 0;

    const stateMap = {};
    const gatewayMap = {};

    orders.forEach((ord) => {
      const tax = ord.taxDetails || {};
      const fee = ord.gatewayFeeDetails || {};

      const taxable = tax.taxableAmount > 0 ? tax.taxableAmount : (ord.subtotal - (ord.discount || 0));
      const cgst = tax.cgst || (tax.isIntraState ? ord.taxAmount / 2 : 0);
      const sgst = tax.sgst || (tax.isIntraState ? ord.taxAmount / 2 : 0);
      const igst = tax.igst || (!tax.isIntraState ? ord.taxAmount : 0);
      const totalTax = tax.totalTax || ord.taxAmount || (cgst + sgst + igst);

      totalTaxableSales += taxable;
      totalGstCollected += totalTax;
      totalCgst += cgst;
      totalSgst += sgst;
      totalIgst += igst;

      const baseFee = fee.baseFee || 0;
      const feeGst = fee.feeGst || 0;
      const totFee = fee.totalFee || (baseFee + feeGst);
      totalGatewayFeesIncurred += totFee;

      if (fee.feePayer === 'customer_pay') {
        gatewayFeesChargedToCustomers += totFee;
      } else {
        gatewayFeesAbsorbedByMerchant += totFee;
      }

      grossTotalRevenue += ord.totalAmount;

      // Group by State
      const custState = tax.customerState || ord.billingAddress?.state || 'Unspecified';
      if (!stateMap[custState]) {
        stateMap[custState] = {
          state: custState,
          ordersCount: 0,
          taxableSales: 0,
          cgst: 0,
          sgst: 0,
          igst: 0,
          totalGst: 0,
        };
      }
      stateMap[custState].ordersCount += 1;
      stateMap[custState].taxableSales = round2(stateMap[custState].taxableSales + taxable);
      stateMap[custState].cgst = round2(stateMap[custState].cgst + cgst);
      stateMap[custState].sgst = round2(stateMap[custState].sgst + sgst);
      stateMap[custState].igst = round2(stateMap[custState].igst + igst);
      stateMap[custState].totalGst = round2(stateMap[custState].totalGst + totalTax);

      // Group by Gateway
      const gw = ord.paymentMethod || 'other';
      if (!gatewayMap[gw]) {
        gatewayMap[gw] = {
          gateway: gw,
          ordersCount: 0,
          processedVolume: 0,
          feesIncurred: 0,
          absorbed: 0,
          chargedToCustomer: 0,
        };
      }
      gatewayMap[gw].ordersCount += 1;
      gatewayMap[gw].processedVolume = round2(gatewayMap[gw].processedVolume + ord.totalAmount);
      gatewayMap[gw].feesIncurred = round2(gatewayMap[gw].feesIncurred + totFee);
      if (fee.feePayer === 'customer_pay') {
        gatewayMap[gw].chargedToCustomer = round2(gatewayMap[gw].chargedToCustomer + totFee);
      } else {
        gatewayMap[gw].absorbed = round2(gatewayMap[gw].absorbed + totFee);
      }
    });

    // Fetch refund tax adjustments
    const refunds = await Refund.find({ status: 'approved' }).populate('order');
    let refundTaxAdjustments = 0;
    refunds.forEach((ref) => {
      if (ref.order?.taxDetails) {
        const ratio = (ref.amount || 0) / (ref.order.totalAmount || 1);
        refundTaxAdjustments += round2((ref.order.taxDetails.totalTax || 0) * ratio);
      }
    });

    const netRevenue = round2(grossTotalRevenue - totalGstCollected - gatewayFeesAbsorbedByMerchant);

    res.status(200).json({
      success: true,
      summary: {
        totalOrders: orders.length,
        totalTaxableSales: round2(totalTaxableSales),
        totalGstCollected: round2(totalGstCollected),
        totalCgst: round2(totalCgst),
        totalSgst: round2(totalSgst),
        totalIgst: round2(totalIgst),
        totalGatewayFeesIncurred: round2(totalGatewayFeesIncurred),
        gatewayFeesAbsorbedByMerchant: round2(gatewayFeesAbsorbedByMerchant),
        gatewayFeesChargedToCustomers: round2(gatewayFeesChargedToCustomers),
        grossTotalRevenue: round2(grossTotalRevenue),
        netRevenue,
        refundTaxAdjustments: round2(refundTaxAdjustments),
      },
      stateDistribution: Object.values(stateMap),
      gatewayBreakdown: Object.values(gatewayMap),
      recentOrders: orders.slice(0, 50),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/tax/reports/export-csv
 * Export GST sales register for accounting & GST return reconciliation
 */
export const exportGstReportCsv = async (req, res, next) => {
  try {
    const orders = await Order.find({ paymentStatus: 'paid' })
      .select('orderNumber createdAt totalAmount subtotal discount taxAmount taxDetails gatewayFeeDetails billingAddress customerName customerEmail paymentMethod')
      .sort({ createdAt: -1 })
      .limit(5000);

    const headers = [
      'Order ID',
      'Date',
      'Customer Name',
      'Customer Email',
      'Place of Supply',
      'Supply Type (Intra/Inter)',
      'Subtotal',
      'Discount',
      'Taxable Value',
      'CGST (Rs)',
      'SGST (Rs)',
      'IGST (Rs)',
      'Total GST (Rs)',
      'Gateway Used',
      'Gateway Fee Incurred',
      'Fee Absorbed by Merchant',
      'Fee Surcharge to Customer',
      'Total Invoice Amount',
    ];

    const rows = orders.map((ord) => {
      const tax = ord.taxDetails || {};
      const fee = ord.gatewayFeeDetails || {};
      const taxable = tax.taxableAmount > 0 ? tax.taxableAmount : (ord.subtotal - (ord.discount || 0));
      const isIntra = tax.isIntraState || false;
      const cgst = tax.cgst || (isIntra ? ord.taxAmount / 2 : 0);
      const sgst = tax.sgst || (isIntra ? ord.taxAmount / 2 : 0);
      const igst = tax.igst || (!isIntra ? ord.taxAmount : 0);
      const totTax = tax.totalTax || ord.taxAmount || (cgst + sgst + igst);
      const totFee = fee.totalFee || 0;
      const isCustPaid = fee.feePayer === 'customer_pay';

      return [
        `"${ord.orderNumber}"`,
        `"${new Date(ord.createdAt).toISOString().split('T')[0]}"`,
        `"${(ord.customerName || '').replace(/"/g, '""')}"`,
        `"${ord.customerEmail || ''}"`,
        `"${tax.customerState || ord.billingAddress?.state || 'Karnataka'}"`,
        `"${isIntra ? 'Intra-State (CGST+SGST)' : 'Inter-State (IGST)'}"`,
        round2(ord.subtotal).toFixed(2),
        round2(ord.discount || 0).toFixed(2),
        round2(taxable).toFixed(2),
        round2(cgst).toFixed(2),
        round2(sgst).toFixed(2),
        round2(igst).toFixed(2),
        round2(totTax).toFixed(2),
        `"${ord.paymentMethod || 'Online'}"`,
        round2(totFee).toFixed(2),
        round2(isCustPaid ? 0 : totFee).toFixed(2),
        round2(isCustPaid ? totFee : 0).toFixed(2),
        round2(ord.totalAmount).toFixed(2),
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=BundleByte_GST_Register_${Date.now()}.csv`);
    res.status(200).send(csvContent);
  } catch (error) {
    next(error);
  }
};
