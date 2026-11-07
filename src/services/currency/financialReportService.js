import FinancialTransaction from '../../models/FinancialTransaction.js';
import Order from '../../models/Order.js';
import Currency from '../../models/Currency.js';

class FinancialReportService {
  /**
   * Aggregate multi-currency financial report
   */
  async getCurrencyFinancialReport({ startDate, endDate } = {}) {
    const filter = { status: { $in: ['settled', 'paid', 'completed'] } };

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const baseCurDoc = (await Currency.findOne({ isBase: true })) || { code: 'INR', symbol: '₹' };

    // 1. Aggregation by customer currency
    const currencyBreakdown = await FinancialTransaction.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$customerCurrency',
          transactionCount: { $sum: 1 },
          totalCustomerVolume: { $sum: '$customerAmount' },
          totalBaseRevenue: { $sum: '$baseAmount' },
          totalMarginEarnedBase: { $sum: '$conversionMarginEarnedBase' },
          totalGatewayFeesBase: { $sum: '$gatewayFeeBase' },
        },
      },
      { $sort: { totalBaseRevenue: -1 } },
    ]);

    // 2. Gateway breakdown
    const gatewayBreakdown = await FinancialTransaction.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$paymentGateway',
          transactionCount: { $sum: 1 },
          totalBaseRevenue: { $sum: '$baseAmount' },
          totalGatewayFeesBase: { $sum: '$gatewayFeeBase' },
        },
      },
      { $sort: { totalBaseRevenue: -1 } },
    ]);

    // 3. Overall Totals
    const totals = currencyBreakdown.reduce(
      (acc, cur) => {
        acc.totalTransactions += cur.transactionCount;
        acc.totalBaseRevenue += cur.totalBaseRevenue;
        acc.totalMarginEarnedBase += cur.totalMarginEarnedBase;
        acc.totalGatewayFeesBase += cur.totalGatewayFeesBase;
        return acc;
      },
      {
        totalTransactions: 0,
        totalBaseRevenue: 0,
        totalMarginEarnedBase: 0,
        totalGatewayFeesBase: 0,
      }
    );

    totals.netPlatformRevenueBase = totals.totalBaseRevenue - totals.totalGatewayFeesBase;

    return {
      baseCurrency: baseCurDoc.code,
      baseCurrencySymbol: baseCurDoc.symbol,
      period: {
        startDate: startDate || 'All-time',
        endDate: endDate || 'Current',
      },
      totals: {
        totalTransactions: totals.totalTransactions,
        totalBaseRevenue: Number(totals.totalBaseRevenue.toFixed(2)),
        totalMarginEarnedBase: Number(totals.totalMarginEarnedBase.toFixed(2)),
        totalGatewayFeesBase: Number(totals.totalGatewayFeesBase.toFixed(2)),
        netPlatformRevenueBase: Number(totals.netPlatformRevenueBase.toFixed(2)),
      },
      currencyBreakdown: currencyBreakdown.map((c) => ({
        currency: c._id,
        transactionCount: c.transactionCount,
        customerVolume: Number(c.totalCustomerVolume.toFixed(2)),
        baseRevenue: Number(c.totalBaseRevenue.toFixed(2)),
        marginEarnedBase: Number(c.totalMarginEarnedBase.toFixed(2)),
        gatewayFeesBase: Number(c.totalGatewayFeesBase.toFixed(2)),
      })),
      gatewayBreakdown: gatewayBreakdown.map((g) => ({
        gateway: g._id,
        transactionCount: g.transactionCount,
        baseRevenue: Number(g.totalBaseRevenue.toFixed(2)),
        gatewayFeesBase: Number(g.totalGatewayFeesBase.toFixed(2)),
      })),
    };
  }

  /**
   * Records a settled transaction into the immutable financial ledger
   */
  async recordFinancialTransaction({
    order,
    type = 'order_payment',
    paymentGateway,
    gatewayTransactionId = '',
    baseAmount,
    customerCurrency,
    customerAmount,
    processingCurrency = 'INR',
    processingAmount,
    exchangeRate,
    conversionMarginPercentage = 0,
    conversionMarginEarnedBase = 0,
    gatewayFeeBase = 0,
    metadata = {},
  }) {
    const baseCurDoc = (await Currency.findOne({ isBase: true })) || { code: 'INR' };

    const transactionReference = `FIN-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

    const finDoc = await FinancialTransaction.create({
      transactionReference,
      type,
      order: order?._id || null,
      user: order?.user || null,
      paymentGateway: paymentGateway || 'paytm',
      gatewayTransactionId,
      baseCurrency: baseCurDoc.code,
      baseAmount: Number(baseAmount.toFixed(2)),
      baseNetRevenue: Number((baseAmount - gatewayFeeBase).toFixed(2)),
      customerCurrency: customerCurrency.toUpperCase(),
      customerAmount: Number(customerAmount.toFixed(2)),
      processingCurrency: processingCurrency.toUpperCase(),
      processingAmount: Number(processingAmount.toFixed(2)),
      exchangeRate: Number(exchangeRate.toFixed(8)),
      conversionMarginPercentage: Number(conversionMarginPercentage.toFixed(2)),
      conversionMarginEarnedBase: Number(conversionMarginEarnedBase.toFixed(2)),
      gatewayFeeBase: Number(gatewayFeeBase.toFixed(2)),
      status: 'settled',
      metadata,
    });

    return finDoc;
  }
}

export const financialReportService = new FinancialReportService();
export default financialReportService;

