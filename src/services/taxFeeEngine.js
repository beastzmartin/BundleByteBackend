import TaxConfiguration, { INDIAN_STATES_AND_CODES } from '../models/TaxConfiguration.js';
import TaxCategory from '../models/TaxCategory.js';
import GatewayFeeConfig from '../models/GatewayFeeConfig.js';
import Product from '../models/Product.js';

// Decimal-safe 2-decimal place precision helper to avoid JS floating-point inaccuracies
export const round2 = (num) => {
  if (isNaN(num) || num === null || num === undefined) return 0;
  return Math.round((Number(num) + Number.EPSILON) * 100) / 100;
};

/**
 * Standard default gateway fee definitions
 */
export const DEFAULT_GATEWAY_CONFIGS = [
  {
    gatewayKey: 'razorpay',
    gatewayName: 'Razorpay PG',
    isEnabled: true,
    feeType: 'percentage',
    percentageFee: 2.0,
    fixedFee: 0,
    minFee: 0,
    maxFee: 0,
    feeGstRate: 18,
    feePayer: 'merchant_absorb',
  },
  {
    gatewayKey: 'paytm',
    gatewayName: 'Paytm Merchant Dynamic QR & PG',
    isEnabled: true,
    feeType: 'percentage',
    percentageFee: 1.8,
    fixedFee: 0,
    minFee: 0,
    maxFee: 0,
    feeGstRate: 18,
    feePayer: 'merchant_absorb',
  },
  {
    gatewayKey: 'phonepe',
    gatewayName: 'PhonePe PG',
    isEnabled: true,
    feeType: 'percentage',
    percentageFee: 1.9,
    fixedFee: 0,
    minFee: 0,
    maxFee: 0,
    feeGstRate: 18,
    feePayer: 'merchant_absorb',
  },
  {
    gatewayKey: 'cashfree',
    gatewayName: 'Cashfree Payments',
    isEnabled: true,
    feeType: 'percentage',
    percentageFee: 1.95,
    fixedFee: 0,
    minFee: 0,
    maxFee: 0,
    feeGstRate: 18,
    feePayer: 'merchant_absorb',
  },
  {
    gatewayKey: 'stripe',
    gatewayName: 'Stripe International',
    isEnabled: true,
    feeType: 'hybrid',
    percentageFee: 3.0,
    fixedFee: 15.0, // approx $0.30 in INR
    minFee: 0,
    maxFee: 0,
    feeGstRate: 18,
    feePayer: 'merchant_absorb',
  },
  {
    gatewayKey: 'binance',
    gatewayName: 'Binance USDT Crypto',
    isEnabled: true,
    feeType: 'percentage',
    percentageFee: 0.5,
    fixedFee: 0,
    minFee: 0,
    maxFee: 0,
    feeGstRate: 0,
    feePayer: 'merchant_absorb',
  },
  {
    gatewayKey: 'upi',
    gatewayName: 'Direct UPI / QR Transfer',
    isEnabled: true,
    feeType: 'percentage',
    percentageFee: 0.0, // 0% for direct UPI
    fixedFee: 0,
    minFee: 0,
    maxFee: 0,
    feeGstRate: 0,
    feePayer: 'merchant_absorb',
  },
  {
    gatewayKey: 'wallet',
    gatewayName: 'Customer Internal Wallet',
    isEnabled: true,
    feeType: 'percentage',
    percentageFee: 0.0,
    fixedFee: 0,
    minFee: 0,
    maxFee: 0,
    feeGstRate: 0,
    feePayer: 'merchant_absorb',
  },
  {
    gatewayKey: 'custom',
    gatewayName: 'Custom Payment Method',
    isEnabled: true,
    feeType: 'percentage',
    percentageFee: 0.0,
    fixedFee: 0,
    minFee: 0,
    maxFee: 0,
    feeGstRate: 0,
    feePayer: 'merchant_absorb',
  },
];

class TaxFeeEngine {
  /**
   * Retrieves or initializes the single centralized TaxConfiguration
   */
  async getTaxConfiguration() {
    let config = await TaxConfiguration.findOne();
    if (!config) {
      config = await TaxConfiguration.create({
        isGstEnabled: true,
        businessLegalName: 'BundleByte Technologies Private Limited',
        tradeName: 'BundleByte',
        gstin: '29ABCDE1234F1Z5',
        panNumber: 'ABCDE1234F',
        registeredAddress: {
          street: '100 Innovation Boulevard, Tech Park',
          city: 'Bangalore',
          state: 'Karnataka',
          stateCode: '29',
          pincode: '560001',
          country: 'India',
        },
        businessState: 'Karnataka',
        businessStateCode: '29',
        defaultGstRate: 18,
        taxCalculationMode: 'exclusive',
        defaultHsnSacCode: '998434',
        isCompositionScheme: false,
        roundingRule: 'round_half_up',
        invoicePrefix: 'INV',
        creditNotePrefix: 'CN',
        taxDisclosureNote:
          'Tax invoice issued under Section 31 of the CGST Act, 2017. All digital products are delivered with applicable GST.',
      });
    }
    return config;
  }

  /**
   * Retrieves Gateway fee configuration for a specific gateway
   */
  async getGatewayFeeConfig(gatewayKey = 'paytm') {
    const cleanKey = (gatewayKey || 'paytm').toLowerCase().trim();
    let feeConfig = await GatewayFeeConfig.findOne({ gatewayKey: cleanKey });

    if (!feeConfig) {
      // Find matching default template or fallback
      const defaultTpl =
        DEFAULT_GATEWAY_CONFIGS.find((d) => d.gatewayKey === cleanKey) || {
          gatewayKey: cleanKey,
          gatewayName: cleanKey.toUpperCase(),
          isEnabled: true,
          feeType: 'percentage',
          percentageFee: 2.0,
          fixedFee: 0,
          minFee: 0,
          maxFee: 0,
          feeGstRate: 18,
          feePayer: 'merchant_absorb',
        };

      try {
        feeConfig = await GatewayFeeConfig.create(defaultTpl);
      } catch (err) {
        // In case of race condition
        feeConfig = await GatewayFeeConfig.findOne({ gatewayKey: cleanKey });
        if (!feeConfig) feeConfig = defaultTpl;
      }
    }

    return feeConfig;
  }

  /**
   * Resolves Indian State metadata and detects Intra-State vs Inter-State supply
   */
  resolvePlaceOfSupply(customerStateInput, businessStateCode = '29', businessState = 'Karnataka') {
    if (!customerStateInput || typeof customerStateInput !== 'string') {
      return {
        customerState: businessState,
        customerStateCode: businessStateCode,
        isIntraState: true,
        placeOfSupply: `${businessState} (${businessStateCode})`,
      };
    }

    const cleanInput = customerStateInput.trim().toLowerCase();

    // Check code or name match
    const matchedState = INDIAN_STATES_AND_CODES.find(
      (st) =>
        st.code === customerStateInput.trim() ||
        st.name.toLowerCase() === cleanInput ||
        cleanInput.includes(st.name.toLowerCase())
    );

    const customerState = matchedState ? matchedState.name : customerStateInput.trim();
    const customerStateCode = matchedState ? matchedState.code : '';

    // Check if intra-state: state code match or case-insensitive state name match
    const isIntraState =
      (customerStateCode && customerStateCode === businessStateCode) ||
      customerState.toLowerCase() === businessState.toLowerCase();

    return {
      customerState,
      customerStateCode,
      isIntraState,
      placeOfSupply: customerStateCode ? `${customerState} (${customerStateCode})` : customerState,
    };
  }

  /**
   * Calculates product item GST breakdown
   */
  async calculateProductTax({
    product,
    unitPrice,
    quantity = 1,
    customerState = 'Karnataka',
    taxModeOverride = null,
  }) {
    const config = await this.getTaxConfiguration();
    const pos = this.resolvePlaceOfSupply(customerState, config.businessStateCode, config.businessState);

    // Resolve GST rate
    let gstRate = config.defaultGstRate || 18;
    if (product?.gstRate !== undefined && product.gstRate !== null && product.gstRate >= 0) {
      gstRate = product.gstRate;
    }

    const hsnSac = product?.hsnSacCode || config.defaultHsnSacCode || '998434';
    const taxMode =
      taxModeOverride || (product?.taxInclusive ? 'inclusive' : config.taxCalculationMode || 'exclusive');

    const totalRaw = round2(unitPrice * quantity);

    if (!config.isGstEnabled || gstRate === 0) {
      return {
        hsnSac,
        taxRate: 0,
        taxMode,
        taxableAmount: totalRaw,
        cgstRate: 0,
        sgstRate: 0,
        igstRate: 0,
        cgst: 0,
        sgst: 0,
        igst: 0,
        totalTax: 0,
        totalAmount: totalRaw,
        isIntraState: pos.isIntraState,
        customerState: pos.customerState,
        customerStateCode: pos.customerStateCode,
      };
    }

    let taxableAmount = 0;
    let totalTax = 0;
    let cgst = 0;
    let sgst = 0;
    let igst = 0;
    let totalAmount = 0;

    let cgstRate = 0;
    let sgstRate = 0;
    let igstRate = 0;

    if (pos.isIntraState) {
      cgstRate = gstRate / 2;
      sgstRate = gstRate / 2;
      igstRate = 0;
    } else {
      cgstRate = 0;
      sgstRate = 0;
      igstRate = gstRate;
    }

    if (taxMode === 'inclusive') {
      // Inclusive formula: Taxable = Gross / (1 + Rate/100)
      totalAmount = totalRaw;
      taxableAmount = round2(totalAmount / (1 + gstRate / 100));
      totalTax = round2(totalAmount - taxableAmount);

      if (pos.isIntraState) {
        cgst = round2(totalTax / 2);
        sgst = round2(totalTax - cgst); // Ensure exact sum matches totalTax
        igst = 0;
      } else {
        cgst = 0;
        sgst = 0;
        igst = totalTax;
      }
    } else {
      // Exclusive formula: Tax = Taxable * Rate / 100
      taxableAmount = totalRaw;

      if (pos.isIntraState) {
        cgst = round2((taxableAmount * cgstRate) / 100);
        sgst = round2((taxableAmount * sgstRate) / 100);
        igst = 0;
      } else {
        cgst = 0;
        sgst = 0;
        igst = round2((taxableAmount * igstRate) / 100);
      }

      totalTax = round2(cgst + sgst + igst);
      totalAmount = round2(taxableAmount + totalTax);
    }

    return {
      hsnSac,
      taxRate: gstRate,
      taxMode,
      taxableAmount,
      cgstRate,
      sgstRate,
      igstRate,
      cgst,
      sgst,
      igst,
      totalTax,
      totalAmount,
      isIntraState: pos.isIntraState,
      customerState: pos.customerState,
      customerStateCode: pos.customerStateCode,
    };
  }

  /**
   * Calculates comprehensive order tax across all items with discount proportioning
   */
  async calculateOrderTax({
    items,
    discount = 0,
    customerState = 'Karnataka',
    taxModeOverride = null,
  }) {
    const config = await this.getTaxConfiguration();
    const pos = this.resolvePlaceOfSupply(customerState, config.businessStateCode, config.businessState);

    let grossSubtotal = 0;
    const itemCalculations = [];

    // 1. First compute raw totals and item-level rates
    for (const item of items) {
      const unitPrice = Number(item.unitPrice) || 0;
      const quantity = Math.max(1, parseInt(item.quantity, 10) || 1);
      const rawLineTotal = round2(unitPrice * quantity);
      grossSubtotal += rawLineTotal;

      let itemGstRate = config.defaultGstRate || 18;
      if (item.taxRate !== undefined && item.taxRate !== null && item.taxRate >= 0) {
        itemGstRate = item.taxRate;
      } else if (item.product?.gstRate !== undefined && item.product?.gstRate !== null && item.product.gstRate >= 0) {
        itemGstRate = item.product.gstRate;
      }

      const hsnSac = item.hsnSac || item.product?.hsnSacCode || config.defaultHsnSacCode || '998434';
      const taxMode =
        taxModeOverride || (item.product?.taxInclusive ? 'inclusive' : config.taxCalculationMode || 'exclusive');

      itemCalculations.push({
        rawItem: item,
        unitPrice,
        quantity,
        rawLineTotal,
        gstRate: itemGstRate,
        hsnSac,
        taxMode,
      });
    }

    grossSubtotal = round2(grossSubtotal);
    const validDiscount = Math.min(grossSubtotal, Math.max(0, Number(discount) || 0));

    let orderTaxableAmount = 0;
    let orderCgst = 0;
    let orderSgst = 0;
    let orderIgst = 0;
    let orderTotalTax = 0;
    let orderFinalPayable = 0;

    const enrichedItems = [];
    const hsnMap = new Map();

    // 2. Pro-rate discount and calculate item taxes
    for (const calc of itemCalculations) {
      // Item proportion of discount
      const itemDiscountProportion = grossSubtotal > 0 ? (calc.rawLineTotal / grossSubtotal) * validDiscount : 0;
      const discountedItemTotal = round2(Math.max(0, calc.rawLineTotal - itemDiscountProportion));

      let itemTaxable = 0;
      let itemCgst = 0;
      let itemSgst = 0;
      let itemIgst = 0;
      let itemTax = 0;
      let itemLineFinal = 0;

      const { gstRate, taxMode, hsnSac } = calc;

      if (!config.isGstEnabled || gstRate === 0) {
        itemTaxable = discountedItemTotal;
        itemTax = 0;
        itemLineFinal = discountedItemTotal;
      } else if (taxMode === 'inclusive') {
        itemLineFinal = discountedItemTotal;
        itemTaxable = round2(discountedItemTotal / (1 + gstRate / 100));
        itemTax = round2(discountedItemTotal - itemTaxable);

        if (pos.isIntraState) {
          itemCgst = round2(itemTax / 2);
          itemSgst = round2(itemTax - itemCgst);
          itemIgst = 0;
        } else {
          itemCgst = 0;
          itemSgst = 0;
          itemIgst = itemTax;
        }
      } else {
        // Exclusive
        itemTaxable = discountedItemTotal;
        if (pos.isIntraState) {
          itemCgst = round2((itemTaxable * (gstRate / 2)) / 100);
          itemSgst = round2((itemTaxable * (gstRate / 2)) / 100);
          itemIgst = 0;
        } else {
          itemCgst = 0;
          itemSgst = 0;
          itemIgst = round2((itemTaxable * gstRate) / 100);
        }
        itemTax = round2(itemCgst + itemSgst + itemIgst);
        itemLineFinal = round2(itemTaxable + itemTax);
      }

      orderTaxableAmount += itemTaxable;
      orderCgst += itemCgst;
      orderSgst += itemSgst;
      orderIgst += itemIgst;
      orderTotalTax += itemTax;
      orderFinalPayable += itemLineFinal;

      // Group HSN/SAC
      if (!hsnMap.has(hsnSac)) {
        hsnMap.set(hsnSac, {
          hsnSac,
          rate: gstRate,
          taxableAmount: 0,
          cgst: 0,
          sgst: 0,
          igst: 0,
          totalTax: 0,
        });
      }
      const hsnSummary = hsnMap.get(hsnSac);
      hsnSummary.taxableAmount = round2(hsnSummary.taxableAmount + itemTaxable);
      hsnSummary.cgst = round2(hsnSummary.cgst + itemCgst);
      hsnSummary.sgst = round2(hsnSummary.sgst + itemSgst);
      hsnSummary.igst = round2(hsnSummary.igst + itemIgst);
      hsnSummary.totalTax = round2(hsnSummary.totalTax + itemTax);

      enrichedItems.push({
        ...calc.rawItem,
        unitPrice: calc.unitPrice,
        quantity: calc.quantity,
        totalPrice: calc.rawLineTotal,
        hsnSac,
        taxRate: gstRate,
        taxableAmount: itemTaxable,
        cgst: itemCgst,
        sgst: itemSgst,
        igst: itemIgst,
        itemTaxAmount: itemTax,
      });
    }

    orderTaxableAmount = round2(orderTaxableAmount);
    orderCgst = round2(orderCgst);
    orderSgst = round2(orderSgst);
    orderIgst = round2(orderIgst);
    orderTotalTax = round2(orderTotalTax);
    orderFinalPayable = round2(orderFinalPayable);

    return {
      subtotal: grossSubtotal,
      discount: validDiscount,
      taxableAmount: orderTaxableAmount,
      cgst: orderCgst,
      sgst: orderSgst,
      igst: orderIgst,
      totalTax: orderTotalTax,
      totalAmount: orderFinalPayable,
      isIntraState: pos.isIntraState,
      placeOfSupply: pos.placeOfSupply,
      customerState: pos.customerState,
      customerStateCode: pos.customerStateCode,
      businessState: config.businessState,
      businessStateCode: config.businessStateCode,
      gstin: config.gstin,
      businessName: config.businessLegalName,
      taxMode: config.taxCalculationMode,
      isGstEnabled: config.isGstEnabled,
      hsnSacSummary: Array.from(hsnMap.values()),
      items: enrichedItems,
    };
  }

  /**
   * Calculates Gateway Fee and GST on Gateway Processing Fee
   */
  async calculateGatewayFee({
    orderAmount = 0,
    gatewayKey = 'paytm',
    paymentMethodType = 'all',
  }) {
    const feeConfig = await this.getGatewayFeeConfig(gatewayKey);
    const amount = Math.max(0, Number(orderAmount) || 0);

    if (!feeConfig || !feeConfig.isEnabled || amount === 0) {
      return {
        gatewayKey,
        gatewayName: feeConfig?.gatewayName || gatewayKey.toUpperCase(),
        isEnabled: false,
        feePayer: 'merchant_absorb',
        baseFee: 0,
        feeGstRate: 0,
        feeGst: 0,
        totalFee: 0,
        customerSurcharge: 0,
        merchantAbsorbed: 0,
      };
    }

    // Check payment method specific override if available
    let percentage = feeConfig.percentageFee || 0;
    let fixed = feeConfig.fixedFee || 0;

    if (Array.isArray(feeConfig.methodFees) && feeConfig.methodFees.length > 0) {
      const match = feeConfig.methodFees.find(
        (m) => m.method === paymentMethodType || m.method === 'all'
      );
      if (match) {
        percentage = match.percentageFee;
        fixed = match.fixedFee;
      }
    }

    let calculatedBase = 0;
    if (feeConfig.feeType === 'percentage') {
      calculatedBase = (amount * percentage) / 100;
    } else if (feeConfig.feeType === 'fixed') {
      calculatedBase = fixed;
    } else {
      // hybrid
      calculatedBase = (amount * percentage) / 100 + fixed;
    }

    // Apply minimum and maximum fee limits
    if (feeConfig.minFee > 0 && calculatedBase < feeConfig.minFee) {
      calculatedBase = feeConfig.minFee;
    }
    if (feeConfig.maxFee > 0 && calculatedBase > feeConfig.maxFee) {
      calculatedBase = feeConfig.maxFee;
    }

    const baseFee = round2(calculatedBase);
    const feeGstRate = feeConfig.feeGstRate || 18;
    const feeGst = round2((baseFee * feeGstRate) / 100);
    const totalFee = round2(baseFee + feeGst);

    const isCustomerPaid = feeConfig.feePayer === 'customer_pay';
    const customerSurcharge = isCustomerPaid ? totalFee : 0;
    const merchantAbsorbed = isCustomerPaid ? 0 : totalFee;

    return {
      gatewayKey: feeConfig.gatewayKey,
      gatewayName: feeConfig.gatewayName,
      isEnabled: true,
      feeType: feeConfig.feeType,
      percentageFee: percentage,
      fixedFee: fixed,
      feeGstRate,
      baseFee,
      feeGst,
      totalFee,
      feePayer: feeConfig.feePayer,
      isCustomerPaid,
      customerSurcharge,
      merchantAbsorbed,
    };
  }

  /**
   * Generates a unified, centralized server Checkout Quote with GST & Gateway fees
   */
  async calculateCheckoutQuote({
    items,
    customerState = 'Karnataka',
    paymentGateway = 'paytm',
    paymentMethodType = 'all',
    discount = 0,
    customerCurrency = 'INR',
  }) {
    // 1. Calculate base Order GST
    const orderTax = await this.calculateOrderTax({
      items,
      discount,
      customerState,
    });

    // 2. Calculate Gateway Processing Fee based on order total
    const gatewayFee = await this.calculateGatewayFee({
      orderAmount: orderTax.totalAmount,
      gatewayKey: paymentGateway,
      paymentMethodType,
    });

    // 3. Final customer payable = product total (tax inclusive or exclusive) + customer surcharge (if enabled)
    const finalPayable = round2(orderTax.totalAmount + gatewayFee.customerSurcharge);
    const merchantNetProceeds = round2(orderTax.totalAmount - gatewayFee.merchantAbsorbed);

    return {
      currency: customerCurrency,
      subtotal: orderTax.subtotal,
      discount: orderTax.discount,
      taxableAmount: orderTax.taxableAmount,
      // Taxes
      gstin: orderTax.gstin,
      businessName: orderTax.businessName,
      businessState: orderTax.businessState,
      businessStateCode: orderTax.businessStateCode,
      customerState: orderTax.customerState,
      customerStateCode: orderTax.customerStateCode,
      placeOfSupply: orderTax.placeOfSupply,
      isIntraState: orderTax.isIntraState,
      taxMode: orderTax.taxMode,
      cgst: orderTax.cgst,
      sgst: orderTax.sgst,
      igst: orderTax.igst,
      totalTax: orderTax.totalTax,
      hsnSacSummary: orderTax.hsnSacSummary,
      items: orderTax.items,
      // Gateway Fees
      gatewayFee: {
        gatewayKey: gatewayFee.gatewayKey,
        gatewayName: gatewayFee.gatewayName,
        feePayer: gatewayFee.feePayer,
        baseFee: gatewayFee.baseFee,
        feeGstRate: gatewayFee.feeGstRate,
        feeGst: gatewayFee.feeGst,
        totalFee: gatewayFee.totalFee,
        customerSurcharge: gatewayFee.customerSurcharge,
        merchantAbsorbed: gatewayFee.merchantAbsorbed,
      },
      // Totals
      productTotal: orderTax.totalAmount,
      finalPayable,
      merchantNetProceeds,
      quoteGeneratedAt: new Date(),
    };
  }

  /**
   * Calculates proportional tax reversal for refunds / credit notes
   */
  calculateRefundTaxAdjustment({ originalOrder, refundAmount }) {
    const totalAmount = originalOrder?.totalAmount || 0;
    const reqAmount = Math.min(totalAmount, Math.max(0, Number(refundAmount) || 0));

    if (totalAmount <= 0 || reqAmount <= 0) {
      return {
        refundAmount: 0,
        taxableAmountRefunded: 0,
        cgstRefunded: 0,
        sgstRefunded: 0,
        igstRefunded: 0,
        totalTaxRefunded: 0,
      };
    }

    const refundRatio = reqAmount / totalAmount;
    const originalTax = originalOrder.taxDetails || {};

    const taxableAmountRefunded = round2((originalTax.taxableAmount || 0) * refundRatio);
    const cgstRefunded = round2((originalTax.cgst || 0) * refundRatio);
    const sgstRefunded = round2((originalTax.sgst || 0) * refundRatio);
    const igstRefunded = round2((originalTax.igst || 0) * refundRatio);
    const totalTaxRefunded = round2(cgstRefunded + sgstRefunded + igstRefunded);

    return {
      refundAmount: reqAmount,
      refundRatio: round2(refundRatio),
      taxableAmountRefunded,
      cgstRefunded,
      sgstRefunded,
      igstRefunded,
      totalTaxRefunded,
      isIntraState: originalTax.isIntraState || false,
      placeOfSupply: originalTax.placeOfSupply || '',
    };
  }
}

export default new TaxFeeEngine();
