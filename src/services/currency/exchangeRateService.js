import axios from 'axios';
import Currency from '../../models/Currency.js';
import ExchangeRate from '../../models/ExchangeRate.js';
import ExchangeRateProvider from '../../models/ExchangeRateProvider.js';
import ExchangeRateHistory from '../../models/ExchangeRateHistory.js';
import ConversionRule from '../../models/ConversionRule.js';
import { BASELINE_RATES_FROM_INR } from './currencySeedService.js';

class ExchangeRateService {
  /**
   * Fetch live exchange rates from active or specified provider
   */
  async fetchRatesFromProvider(providerConfig, baseCurrency = 'INR') {
    const { providerKey, apiKey, apiEndpoint } = providerConfig;

    try {
      if (providerKey === 'exchangerate_api') {
        const url = apiKey
          ? `https://v6.exchangerate-api.com/v6/${apiKey}/latest/${baseCurrency}`
          : `https://open.er-api.com/v6/latest/${baseCurrency}`;

        const res = await axios.get(url, { timeout: 10000 });
        if (res.data && res.data.rates) {
          return {
            success: true,
            provider: 'exchangerate_api',
            base: baseCurrency,
            rates: res.data.rates,
          };
        }
      }

      if (providerKey === 'open_exchange_rates') {
        if (!apiKey) throw new Error('Open Exchange Rates requires a valid App ID');
        const url = `${apiEndpoint || 'https://openexchangerates.org/api/latest.json'}?app_id=${apiKey}&base=${baseCurrency}`;
        const res = await axios.get(url, { timeout: 10000 });
        if (res.data && res.data.rates) {
          return {
            success: true,
            provider: 'open_exchange_rates',
            base: baseCurrency,
            rates: res.data.rates,
          };
        }
      }

      if (providerKey === 'currencylayer') {
        if (!apiKey) throw new Error('CurrencyLayer requires a valid Access Key');
        const url = `${apiEndpoint || 'http://api.currencylayer.com/live'}?access_key=${apiKey}&source=${baseCurrency}`;
        const res = await axios.get(url, { timeout: 10000 });
        if (res.data && res.data.quotes) {
          // CurrencyLayer returns keys like INRUSD, INREUR
          const rates = {};
          for (const [pair, rate] of Object.entries(res.data.quotes)) {
            const target = pair.replace(baseCurrency, '');
            rates[target] = rate;
          }
          return {
            success: true,
            provider: 'currencylayer',
            base: baseCurrency,
            rates,
          };
        }
      }

      throw new Error(`Unsupported provider or missing endpoint for ${providerKey}`);
    } catch (err) {
      console.warn(`[ExchangeRateService] Live fetch failed for provider ${providerKey}: ${err.message}`);
      return {
        success: false,
        error: err.message,
      };
    }
  }

  /**
   * Sync exchange rates for all enabled currencies against the platform base currency
   */
  async syncExchangeRates(specificProviderKey = null, changedByAdminId = null) {
    // 1. Identify base currency
    const baseCurDoc = await Currency.findOne({ isBase: true }) || { code: 'INR' };
    const baseCode = baseCurDoc.code;

    // 2. Identify active provider
    let providerDoc;
    if (specificProviderKey) {
      providerDoc = await ExchangeRateProvider.findOne({ providerKey: specificProviderKey });
    } else {
      providerDoc = await ExchangeRateProvider.findOne({ isActive: true }).sort({ priority: 1 });
    }

    if (!providerDoc) {
      providerDoc = { providerKey: 'exchangerate_api', name: 'ExchangeRate-API' };
    }

    // 3. Fetch rates from external API
    let fetchResult = await this.fetchRatesFromProvider(providerDoc, baseCode);

    // If active provider failed, fallback to public open endpoint or baseline
    if (!fetchResult.success && providerDoc.providerKey !== 'exchangerate_api') {
      console.log('🔄 Attempting fallback to ExchangeRate-API open feed...');
      fetchResult = await this.fetchRatesFromProvider(
        { providerKey: 'exchangerate_api', apiEndpoint: 'https://open.er-api.com/v6/latest' },
        baseCode
      );
    }

    const enabledCurrencies = await Currency.find({ isEnabled: true });
    const targetCodes = enabledCurrencies.map((c) => c.code);

    // Retrieve active conversion rules for margin calculation
    const rules = await ConversionRule.find({ isActive: true }).sort({ priority: -1 });
    const globalRule = rules.find((r) => r.scope === 'global');
    const globalMarginPercent = globalRule ? globalRule.marginPercentage : 2.0;

    const updatedRates = [];
    const now = new Date();

    for (const targetCode of targetCodes) {
      if (targetCode === baseCode) {
        // Base currency rate to itself is always 1
        await ExchangeRate.findOneAndUpdate(
          { baseCurrency: baseCode, targetCurrency: baseCode },
          {
            providerRate: 1.0,
            rateInverse: 1.0,
            effectiveRate: 1.0,
            marginPercentage: 0,
            fixedMargin: 0,
            provider: 'system',
            isManual: false,
            isStale: false,
            lastUpdated: now,
            syncStatus: 'synced',
          },
          { upsert: true, new: true }
        );
        continue;
      }

      // Check per-currency margin rule
      const curRule = rules.find((r) => r.scope === 'currency' && r.targetCurrency === targetCode);
      const appliedMargin = curRule ? curRule.marginPercentage : globalMarginPercent;
      const appliedFixed = curRule ? curRule.fixedCharge : 0;

      let rawRate = 0;
      let inverse = 0;
      let usedProvider = providerDoc.providerKey;

      if (fetchResult.success && fetchResult.rates && fetchResult.rates[targetCode]) {
        rawRate = Number(fetchResult.rates[targetCode]);
        inverse = rawRate > 0 ? 1 / rawRate : 0;
      } else {
        // If API did not return this target, check existing record or baseline
        const existing = await ExchangeRate.findOne({ baseCurrency: baseCode, targetCurrency: targetCode });
        if (existing && !existing.isStale) {
          rawRate = existing.providerRate;
          inverse = existing.rateInverse;
          usedProvider = existing.provider;
        } else if (BASELINE_RATES_FROM_INR[targetCode]) {
          rawRate = BASELINE_RATES_FROM_INR[targetCode].rate;
          inverse = BASELINE_RATES_FROM_INR[targetCode].inverse;
          usedProvider = 'fallback';
        }
      }

      if (rawRate <= 0) continue;

      // Effective rate calculation:
      // When customer converts from Base (e.g. ₹1000) to USD,
      // Effective Rate = rawRate / (1 + margin%)
      // This means 1 USD costs more in Base Currency (e.g. ₹90.27 instead of ₹88.50).
      const effectiveRate = Number((rawRate * (1 - appliedMargin / 100)).toFixed(8));

      // Check previous rate to log changes
      const prevDoc = await ExchangeRate.findOne({ baseCurrency: baseCode, targetCurrency: targetCode });
      const previousRate = prevDoc ? prevDoc.providerRate : rawRate;
      const rateChangePercent = previousRate > 0 ? ((rawRate - previousRate) / previousRate) * 100 : 0;

      const rateDoc = await ExchangeRate.findOneAndUpdate(
        { baseCurrency: baseCode, targetCurrency: targetCode },
        {
          providerRate: rawRate,
          rateInverse: Number(inverse.toFixed(6)),
          marginPercentage: appliedMargin,
          fixedMargin: appliedFixed,
          effectiveRate,
          provider: usedProvider,
          isManual: false,
          isStale: false,
          lastUpdated: now,
          previousRate,
          rateChangePercent: Number(rateChangePercent.toFixed(4)),
          syncStatus: 'synced',
        },
        { upsert: true, new: true }
      );

      // Record in history if rate moved or on explicit admin sync
      if (Math.abs(rateChangePercent) > 0.001 || specificProviderKey) {
        await ExchangeRateHistory.create({
          baseCurrency: baseCode,
          targetCurrency: targetCode,
          oldRate: previousRate,
          newRate: rawRate,
          changePercent: Number(rateChangePercent.toFixed(4)),
          source: 'auto_sync',
          provider: usedProvider,
          changedBy: changedByAdminId,
          reason: `Automatic synchronization via ${usedProvider}`,
        });
      }

      updatedRates.push(rateDoc);
    }

    // Update provider status
    if (providerDoc._id) {
      await ExchangeRateProvider.findByIdAndUpdate(providerDoc._id, {
        lastSyncAt: now,
        lastSyncStatus: fetchResult.success ? 'success' : 'failed',
        lastError: fetchResult.success ? '' : fetchResult.error,
        ratesCount: updatedRates.length,
      });
    }

    return {
      success: true,
      provider: providerDoc.providerKey,
      baseCurrency: baseCode,
      updatedCount: updatedRates.length,
      timestamp: now,
      rates: updatedRates,
    };
  }

  /**
   * Set manual exchange rate override for a currency
   */
  async setManualRate(targetCurrency, rateInverse, marginPercentage = 0, adminUserId = null, reason = 'Manual administrator override') {
    const baseCurDoc = await Currency.findOne({ isBase: true }) || { code: 'INR' };
    const baseCode = baseCurDoc.code;
    const targetCode = targetCurrency.toUpperCase();

    if (baseCode === targetCode) {
      throw new Error('Cannot set manual exchange rate for the base currency against itself');
    }

    const inverse = Number(rateInverse);
    if (!inverse || inverse <= 0) {
      throw new Error('Valid target-to-base rate inverse is required (e.g. 1 USD = 88.50 INR)');
    }

    // 1 Base = rawRate Target (e.g. 1 INR = 1 / 88.50 USD)
    const rawRate = Number((1 / inverse).toFixed(8));
    const margin = Number(marginPercentage) || 0;
    const effectiveRate = Number((rawRate * (1 - margin / 100)).toFixed(8));

    const existing = await ExchangeRate.findOne({ baseCurrency: baseCode, targetCurrency: targetCode });
    const oldRate = existing ? existing.providerRate : rawRate;
    const rateChangePercent = oldRate > 0 ? ((rawRate - oldRate) / oldRate) * 100 : 0;

    const rateDoc = await ExchangeRate.findOneAndUpdate(
      { baseCurrency: baseCode, targetCurrency: targetCode },
      {
        providerRate: rawRate,
        rateInverse: Number(inverse.toFixed(6)),
        marginPercentage: margin,
        effectiveRate,
        provider: 'manual',
        isManual: true,
        isStale: false,
        lastUpdated: new Date(),
        previousRate: oldRate,
        rateChangePercent: Number(rateChangePercent.toFixed(4)),
        syncStatus: 'manual',
      },
      { upsert: true, new: true }
    );

    // Record immutable audit history
    await ExchangeRateHistory.create({
      baseCurrency: baseCode,
      targetCurrency: targetCode,
      oldRate,
      newRate: rawRate,
      changePercent: Number(rateChangePercent.toFixed(4)),
      source: 'manual_override',
      provider: 'manual',
      changedBy: adminUserId,
      reason,
    });

    return rateDoc;
  }

  /**
   * Get active exchange rate between two currencies with staleness check
   */
  async getExchangeRate(fromCurrency, toCurrency) {
    const from = fromCurrency.toUpperCase();
    const to = toCurrency.toUpperCase();

    if (from === to) {
      return {
        fromCurrency: from,
        toCurrency: to,
        rate: 1.0,
        rateInverse: 1.0,
        effectiveRate: 1.0,
        marginPercentage: 0,
        isStale: false,
      };
    }

    const baseCurDoc = await Currency.findOne({ isBase: true }) || { code: 'INR' };
    const baseCode = baseCurDoc.code;

    // Direct from Base to Target
    if (from === baseCode) {
      let doc = await ExchangeRate.findOne({ baseCurrency: baseCode, targetCurrency: to });
      if (!doc) {
        // Fallback sync if missing
        await this.syncExchangeRates();
        doc = await ExchangeRate.findOne({ baseCurrency: baseCode, targetCurrency: to });
      }

      if (!doc) {
        throw new Error(`Exchange rate not available for currency ${to}`);
      }

      // Check staleness
      const ageHours = (Date.now() - new Date(doc.lastUpdated).getTime()) / (1000 * 60 * 60);
      const isStale = ageHours > (doc.maxAgeHours || 24);

      return {
        fromCurrency: from,
        toCurrency: to,
        providerRate: doc.providerRate,
        rateInverse: doc.rateInverse,
        effectiveRate: doc.effectiveRate,
        marginPercentage: doc.marginPercentage,
        fixedMargin: doc.fixedMargin,
        isStale,
        lastUpdated: doc.lastUpdated,
      };
    }

    // Direct from Target to Base
    if (to === baseCode) {
      const doc = await ExchangeRate.findOne({ baseCurrency: baseCode, targetCurrency: from });
      if (!doc) {
        throw new Error(`Exchange rate not available for currency ${from}`);
      }

      const ageHours = (Date.now() - new Date(doc.lastUpdated).getTime()) / (1000 * 60 * 60);
      const isStale = ageHours > (doc.maxAgeHours || 24);

      return {
        fromCurrency: from,
        toCurrency: to,
        providerRate: doc.rateInverse,
        rateInverse: doc.providerRate,
        effectiveRate: doc.rateInverse * (1 + doc.marginPercentage / 100),
        marginPercentage: doc.marginPercentage,
        fixedMargin: doc.fixedMargin,
        isStale,
        lastUpdated: doc.lastUpdated,
      };
    }

    // Cross-rate conversion via Base Currency: from -> Base -> to
    const rate1 = await this.getExchangeRate(from, baseCode);
    const rate2 = await this.getExchangeRate(baseCode, to);

    const crossEffectiveRate = rate1.effectiveRate * rate2.effectiveRate;
    return {
      fromCurrency: from,
      toCurrency: to,
      crossVia: baseCode,
      effectiveRate: crossEffectiveRate,
      rateInverse: crossEffectiveRate > 0 ? 1 / crossEffectiveRate : 0,
      isStale: rate1.isStale || rate2.isStale,
      lastUpdated: new Date(Math.min(new Date(rate1.lastUpdated).getTime(), new Date(rate2.lastUpdated).getTime())),
    };
  }

  /**
   * Convert an amount with decimal rounding rule
   */
  applyRoundingRule(amount, rule = 'none', decimalDigits = 2) {
    let result = Number(amount);

    if (rule === 'ceil') {
      result = Math.ceil(result);
    } else if (rule === 'floor') {
      result = Math.floor(result);
    } else if (rule === 'round_to_99') {
      result = Math.floor(result) + 0.99;
    } else if (rule === 'round_to_00') {
      result = Math.round(result);
    }

    return Number(result.toFixed(decimalDigits));
  }
}

export const exchangeRateService = new ExchangeRateService();
export default exchangeRateService;

