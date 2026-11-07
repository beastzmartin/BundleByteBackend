import EmailLog from '../models/EmailLog.js';

export const getEmailAnalyticsData = async ({ days = 30, category, status } = {}) => {
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - Number(days));

  const filter = { createdAt: { $gte: sinceDate } };
  if (category && category !== 'all') filter.category = category;
  if (status && status !== 'all') filter.status = status;

  // 1. Overall counts
  const [total, sent, failed, queued, retrying] = await Promise.all([
    EmailLog.countDocuments(filter),
    EmailLog.countDocuments({ ...filter, status: 'sent' }),
    EmailLog.countDocuments({ ...filter, status: 'failed' }),
    EmailLog.countDocuments({ ...filter, status: 'queued' }),
    EmailLog.countDocuments({ ...filter, status: 'retrying' }),
  ]);

  const deliveryRate = total > 0 ? Number(((sent / total) * 100).toFixed(1)) : 100;
  const failureRate = total > 0 ? Number(((failed / total) * 100).toFixed(1)) : 0;

  // 2. Category distribution
  const categoryBreakdown = await EmailLog.aggregate([
    { $match: filter },
    { $group: { _id: '$category', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  // 3. Provider distribution
  const providerBreakdown = await EmailLog.aggregate([
    { $match: filter },
    { $group: { _id: '$provider', count: { $sum: 1 } } },
  ]);

  // 4. Daily timeline volume (grouped by YYYY-MM-DD)
  const dailyTimeline = await EmailLog.aggregate([
    { $match: filter },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        total: { $sum: 1 },
        sent: {
          $sum: { $cond: [{ $eq: ['$status', 'sent'] }, 1, 0] },
        },
        failed: {
          $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] },
        },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return {
    overview: {
      total,
      sent,
      failed,
      queued,
      retrying,
      deliveryRate,
      failureRate,
    },
    categoryBreakdown: categoryBreakdown.map((c) => ({
      category: c._id || 'other',
      count: c.count,
    })),
    providerBreakdown: providerBreakdown.map((p) => ({
      provider: p._id || 'simulation',
      count: p.count,
    })),
    dailyTimeline: dailyTimeline.map((d) => ({
      date: d._id,
      total: d.total,
      sent: d.sent,
      failed: d.failed,
    })),
  };
};
