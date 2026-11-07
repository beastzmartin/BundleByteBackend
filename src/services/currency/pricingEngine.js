import crypto from 'crypto';
import Currency from '../../models/Currency.js';
import Product from '../../models/Product.js';
import ProductCurrencyPrice from '../../models/ProductCurrencyPrice.js';
import GatewayCurrencyConfig from '../../models/GatewayCurrencyConfig.js';
import CurrencyQuote from '../../models/CurrencyQuote.js';
import ConversionRule from '../../models/ConversionRule.js';
import exchangeRateService from './exchangeRateService.js';

class PricingEngine {
  /**
   * Resolves product price for a specific duration in target customer currency
   */
  async getProductPrice(product, duration, targetCurrency = 'INR') {
    const curCode = targetCurrency.toUpperCase();
    const durationKey = duration || product.defaultDuration || 'annual';
    const tier = product.pricing ? product.pricing[durationKey] : null;

    if (!tier || !tier.enabled) {
      return {
        enabled: false,
        price: 0,
        originalPrice: 0,
        currency: curCode,
        isManual: false,
      };
    }

    const basePrice = tier.price || 0;
    const baseOriginalPrice = tier.originalPrice || basePrice;

    // 1. Check for manual product currency price override
    const manualDoc = await ProductCurrencyPrice.findOne({
      product: product._id,
      currency: curCode,
      duration: durationKey,
      isManual: true,
    });

    if (manualDoc && manualDoc.manualPrice > 0) {
      return {
        enabled: true,
        price: manualDoc.manualPrice,
        originalPrice: manualDoc.manualOriginalPrice || manualDoc.manualPrice,
        currency: curCode,
        isManual: true,
        basePrice,
        baseOriginalPrice,
      };
    }

    // 2. Fetch Currency metadata for rounding rule and decimal digits
    const currencyDoc = (await Currency.findOne({ code: curCode })) || {
      decimalDigits: 2,
      roundingRule: 'none',
      isBase: curCode === 'INR',
    };

    if (currencyDoc.isBase) {
      return {
        enabled: true,
        price: basePrice,
        originalPrice: baseOriginalPrice,
        currency: curCode,
        isManual: false,
        basePrice,
        baseOriginalPrice,
      };
    }

    // 3. Convert via exchange rate engine
    const baseCurDoc = (await Currency.findOne({ isBase: true })) || { code: 'INR' };
    const rateInfo = await exchangeRateService.getExchangeRate(baseCurDoc.code, curCode);

    const rawConverted = basePrice * rateInfo.effectiveRate;
    const rawConvertedOriginal = baseOriginalPrice * rateInfo.effectiveRate;

    const finalPrice = exchangeRateService.applyRoundingRule(
      rawConverted,
      currencyDoc.roundingRule,
      currencyDoc.decimalDigits
    );

    const finalOriginalPrice = exchangeRateService.applyRoundingRule(
      rawConvertedOriginal,
      currencyDoc.roundingRule,
      currencyDoc.decimalDigits
    );

    return {
      enabled: true,
      price: finalPrice,
      originalPrice: finalOriginalPrice,
      currency: curCode,
      isManual: false,
      basePrice,
      baseOriginalPrice,
      exchangeRate: rateInfo.effectiveRate,
      rateInverse: rateInfo.rateInverse,
      isStale: rateInfo.isStale,
    };
  }

  /**
   * Generates an immutable, locked CurrencyQuote for checkout
   */
  async createCheckoutQuote({
    items,
    customerCurrency = 'INR',
    paymentGateway = 'paytm',
    user = null,
    coupon = null,
  }) {
    const custCurCode = customerCurrency.toUpperCase();
    const baseCurDoc = (await Currency.findOne({ isBase: true })) || { code: 'INR' };
    const baseCode = baseCurDoc.code;

    // Fetch customer currency info
    const custCurrencyDoc = (await Currency.findOne({ code: custCurCode })) || {
      code: custCurCode,
      decimalDigits: 2,
      roundingRule: 'none',
      symbol: custCurCode,
      symbolPosition: 'prefix',
    };

    // Fetch gateway currency configuration
    const gatewayDoc = (await GatewayCurrencyConfig.findOne({ gatewayKey: paymentGateway })) || {
      gatewayKey: paymentGateway,
      settlementCurrency: 'INR',
      processingCurrency: 'INR',
      percentageFee: 0,
      fixedFee: 0,
    };

    const processingCurrency = gatewayDoc.processingCurrency || 'INR';

    // Fetch active exchange rate Base -> Customer
    const rateInfo = await exchangeRateService.getExchangeRate(baseCode, custCurCode);

    // Build quote items
    let baseSubtotal = 0;
    let customerSubtotal = 0;
    const quoteItems = [];

    for (const item of items) {
      const prodId = (typeof item.product === 'object' && item.product?._id) ? item.product._id : (item.product || item.productId);
      const product = prodId ? await Product.findById(prodId) : null;
      if (!product) continue;

      const duration = item.duration || product.defaultDuration || 'annual';
      const quantity = Math.max(1, parseInt(item.quantity) || 1);

      const pricing = await this.getProductPrice(product, duration, custCurCode);
      const baseItemPrice = pricing.basePrice * quantity;
      const customerItemPrice = pricing.price * quantity;

      baseSubtotal += baseItemPrice;
      customerSubtotal += customerItemPrice;

      quoteItems.push({
        product: product._id,
        productTitle: product.title,
        duration,
        quantity,
        baseUnitPrice: pricing.basePrice,
        baseTotalPrice: baseItemPrice,
        customerUnitPrice: pricing.price,
        customerTotalPrice: customerItemPrice,
        isManualPricing: pricing.isManual,
      });
    }

    // Apply Coupon discount
    let baseDiscount = 0;
    let customerDiscount = 0;
    if (coupon) {
      if (coupon.discountType === 'percentage') {
        const pct = Math.min(100, Math.max(0, coupon.discountValue));
        baseDiscount = (baseSubtotal * pct) / 100;
        customerDiscount = (customerSubtotal * pct) / 100;
      } else {
        // Fixed discount: if in base currency or customer currency
        baseDiscount = Math.min(baseSubtotal, coupon.discountValue);
        customerDiscount = Math.min(customerSubtotal, coupon.discountValue * rateInfo.effectiveRate);
      }
    }

    const baseAfterDiscount = Math.max(0, baseSubtotal - baseDiscount);
    const customerAfterDiscount = Math.max(0, customerSubtotal - customerDiscount);

    // Gateway processing fee (percentage + fixed)
    const gatewayFeePct = gatewayDoc.percentageFee || 0;
    const gatewayFixed = gatewayDoc.fixedFee || 0;
    const customerGatewayFee = Number(
      ((customerAfterDiscount * gatewayFeePct) / 100 + gatewayFixed).toFixed(custCurrencyDoc.decimalDigits)
    );

    // Conversion margin breakdown
    const marginPct = rateInfo.marginPercentage || 0;
    const conversionMarginAmount = Number(
      ((customerAfterDiscount * marginPct) / 100).toFixed(custCurrencyDoc.decimalDigits)
    );

    // Customer final payable total
    const customerTotal = Number(
      (customerAfterDiscount + customerGatewayFee).toFixed(custCurrencyDoc.decimalDigits)
    );

    // Calculate processing currency total (what the gateway will actually process)
    let processingTotal = baseAfterDiscount;
    if (processingCurrency !== baseCode) {
      const procRate = await exchangeRateService.getExchangeRate(baseCode, processingCurrency);
      processingTotal = Number((baseAfterDiscount * procRate.effectiveRate).toFixed(2));
    } else {
      processingTotal = Number(baseAfterDiscount.toFixed(2));
    }

    // Generate unique quote token
    const quoteId = `QUO-${crypto.randomBytes(4).toString('hex').toUpperCase()}-${Date.now()}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15-minute lock

    const quoteDoc = await CurrencyQuote.create({
      quoteId,
      user: user?._id || null,
      items: quoteItems,
      baseCurrency: baseCode,
      customerCurrency: custCurCode,
      processingCurrency,
      exchangeRate: rateInfo.effectiveRate,
      rateInverse: rateInfo.rateInverse,
      baseSubtotal: Number(baseSubtotal.toFixed(2)),
      baseDiscount: Number(baseDiscount.toFixed(2)),
      baseTaxAmount: 0,
      baseTotal: Number(baseAfterDiscount.toFixed(2)),
      customerSubtotal: Number(customerSubtotal.toFixed(custCurrencyDoc.decimalDigits)),
      customerDiscount: Number(customerDiscount.toFixed(custCurrencyDoc.decimalDigits)),
      marginPercentage: marginPct,
      conversionMarginAmount,
      gatewayFee: customerGatewayFee,
      customerTaxAmount: 0,
      customerTotal,
      processingTotal,
      paymentGateway,
      couponCode: coupon?.code || '',
      expiresAt,
      isUsed: false,
    });

    return {
      quoteId: quoteDoc.quoteId,
      baseCurrency: baseCode,
      customerCurrency: custCurCode,
      processingCurrency,
      exchangeRate: rateInfo.effectiveRate,
      rateInverse: rateInfo.rateInverse,
      baseTotal: quoteDoc.baseTotal,
      customerSubtotal: quoteDoc.customerSubtotal,
      customerDiscount: quoteDoc.customerDiscount,
      marginPercentage: marginPct,
      conversionMarginAmount,
      gatewayFee: customerGatewayFee,
      customerTotal,
      processingTotal,
      expiresAt,
      validitySeconds: Math.floor((expiresAt.getTime() - Date.now()) / 1000),
      items: quoteItems,
      gatewayConfig: {
        gatewayKey: gatewayDoc.gatewayKey,
        gatewayName: gatewayDoc.gatewayName,
        processingCurrency: gatewayDoc.processingCurrency,
        settlementCurrency: gatewayDoc.settlementCurrency,
        requiresConversion: gatewayDoc.requiresConversion,
      },
    };
  }
}

export const pricingEngine = new PricingEngine();
export default pricingEngine;
