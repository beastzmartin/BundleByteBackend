import express from 'express';
import slaService from '../services/slaService.js';
import { runPaytmPendingVerificationPass } from '../services/payment/paytmCronService.js';

const router = express.Router();

// Helper to protect cron routes if CRON_SECRET is configured
const verifyCronSecret = (req, res, next) => {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return next(); // If no secret set, allow call
  }

  const authHeader = req.headers.authorization;
  if (authHeader === `Bearer ${cronSecret}` || req.query.secret === cronSecret) {
    return next();
  }

  return res.status(401).json({ success: false, message: 'Unauthorized cron request' });
};

// Route: Check and escalate SLA tickets
router.get('/sla', verifyCronSecret, async (req, res) => {
  try {
    const result = await slaService.checkAndEscalateTickets();
    res.json({
      success: true,
      job: 'sla_check',
      timestamp: new Date().toISOString(),
      result: result || 'SLA escalation pass completed',
    });
  } catch (error) {
    console.error('Cron SLA check failed:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Route: Run automated verification pass for pending Paytm payments
router.get('/paytm', verifyCronSecret, async (req, res) => {
  try {
    await runPaytmPendingVerificationPass();
    res.json({
      success: true,
      job: 'paytm_verification',
      timestamp: new Date().toISOString(),
      message: 'Paytm pending verification pass completed',
    });
  } catch (error) {
    console.error('Cron Paytm verification failed:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;

