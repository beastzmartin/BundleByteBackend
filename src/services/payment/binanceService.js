import crypto from 'crypto';
import WebsiteSetting from '../../models/WebsiteSetting.js';
import { decryptCredential } from '../../utils/credentialEncryption.js';

const BINANCE_BASE_URL = 'https://api.binance.com';

/**
 * Retrieve decrypted Binance API credentials from database settings or environment
 */
export const getBinanceCredentials = async () => {
  const settings = await WebsiteSetting.findOne();
  const binanceConfig = settings?.gateways?.binance || {};

  let apiKey = binanceConfig.apiKey || process.env.BINANCE_API_KEY || '';
  let apiSecret = binanceConfig.apiSecret || process.env.BINANCE_API_SECRET || '';

  // Decrypt if encrypted with AES-256-GCM
  if (apiKey && apiKey.includes(':')) {
    apiKey = decryptCredential(apiKey);
  }
  if (apiSecret && apiSecret.includes(':')) {
    apiSecret = decryptCredential(apiSecret);
  }

  return {
    apiKey: apiKey.trim(),
    apiSecret: apiSecret.trim(),
    depositAddress: binanceConfig.depositAddress || 'TLR7Vw3G1uK4K4U5w6q7N9x8yZ2A1B3C4D',
    network: binanceConfig.network || 'TRX',
    autoVerifyEnabled: binanceConfig.autoVerifyEnabled !== false,
    usdtToUsdRate: binanceConfig.usdtToUsdRate || 1.0,
    usdtToInrRate: binanceConfig.usdtToInrRate || 86.5,
    isConfigured: !!(apiKey && apiSecret),
  };
};

/**
 * Sign query string with HMAC-SHA256 using Binance API Secret
 */
export const signBinanceRequest = (params, apiSecret) => {
  const timestamp = Date.now();
  const fullParams = {
    ...params,
    timestamp,
    recvWindow: 60000,
  };

  const queryString = Object.keys(fullParams)
    .map((key) => `${key}=${encodeURIComponent(fullParams[key])}`)
    .join('&');

  const signature = crypto.createHmac('sha256', apiSecret).update(queryString).digest('hex');

  return `${queryString}&signature=${signature}`;
};

/**
 * Test connectivity to Binance API using API key & secret
 */
export const testBinanceConnection = async () => {
  try {
    const creds = await getBinanceCredentials();

    if (!creds.apiKey || !creds.apiSecret) {
      return {
        connected: false,
        isConfigured: false,
        status: 'unconfigured',
        message: 'Binance API Key and Secret Key are not configured.',
        depositAddress: creds.depositAddress,
        network: creds.network,
      };
    }

    // 1. Check basic ping
    let pingOk = false;
    try {
      const pingRes = await fetch(`${BINANCE_BASE_URL}/api/v3/ping`, { signal: AbortSignal.timeout(5000) });
      pingOk = pingRes.ok;
    } catch {
      pingOk = false;
    }

    // 2. Check authenticated personal account endpoint
    const signedQuery = signBinanceRequest({}, creds.apiSecret);
    const accRes = await fetch(`${BINANCE_BASE_URL}/api/v3/account?${signedQuery}`, {
      method: 'GET',
      headers: {
        'X-MBX-APIKEY': creds.apiKey,
      },
      signal: AbortSignal.timeout(8000),
    });

    const accData = await accRes.json();

    if (accRes.ok) {
      return {
        connected: true,
        isConfigured: true,
        status: 'connected',
        accountType: accData.accountType || 'SPOT',
        canDeposit: true,
        permissions: accData.permissions || ['SPOT'],
        message: 'Successfully authenticated with Binance Personal Account API.',
        depositAddress: creds.depositAddress,
        network: creds.network,
      };
    } else {
      return {
        connected: false,
        isConfigured: true,
        status: 'auth_failed',
        code: accData.code,
        message: accData.msg || 'Binance authentication failed. Verify API Key and Secret.',
        depositAddress: creds.depositAddress,
        network: creds.network,
      };
    }
  } catch (err) {
    return {
      connected: false,
      isConfigured: true,
      status: 'network_error',
      message: `Failed to reach Binance API: ${err.message}`,
    };
  }
};

/**
 * Get active deposit address for USDT on specified network (TRX, BSC, ETH)
 */
export const fetchBinanceDepositAddress = async ({ coin = 'USDT', network = 'TRX' } = {}) => {
  const creds = await getBinanceCredentials();

  if (!creds.apiKey || !creds.apiSecret) {
    return {
      success: true,
      coin,
      network: creds.network || network,
      address: creds.depositAddress,
      tag: '',
      isFallback: true,
    };
  }

  try {
    const signedQuery = signBinanceRequest({ coin, network }, creds.apiSecret);
    const res = await fetch(`${BINANCE_BASE_URL}/sapi/v1/capital/deposit/address?${signedQuery}`, {
      headers: { 'X-MBX-APIKEY': creds.apiKey },
      signal: AbortSignal.timeout(8000),
    });

    const data = await res.json();
    if (res.ok && data.address) {
      return {
        success: true,
        coin: data.coin || coin,
        network: network,
        address: data.address,
        tag: data.tag || '',
        url: data.url || '',
        isFallback: false,
      };
    }

    return {
      success: true,
      coin,
      network: creds.network || network,
      address: creds.depositAddress,
      tag: '',
      isFallback: true,
      warning: data.msg || 'Using configured static deposit address',
    };
  } catch (err) {
    return {
      success: true,
      coin,
      network: creds.network || network,
      address: creds.depositAddress,
      tag: '',
      isFallback: true,
      warning: `Binance API error: ${err.message}`,
    };
  }
};

/**
 * Retrieve deposit history from official Binance API (/sapi/v1/capital/deposit/hisrec)
 */
export const fetchBinanceDepositHistory = async ({ coin = 'USDT', status = 1, limit = 50, startTime } = {}) => {
  const creds = await getBinanceCredentials();

  if (!creds.apiKey || !creds.apiSecret) {
    return {
      success: false,
      message: 'Binance API credentials not configured',
      deposits: [],
    };
  }

  try {
    const params = { coin, limit };
    if (status !== undefined && status !== null && status !== 'all') {
      params.status = status; // 1 = success, 0 = pending, 6 = credited but cannot withdraw
    }
    if (startTime) {
      params.startTime = startTime;
    }

    const signedQuery = signBinanceRequest(params, creds.apiSecret);
    const res = await fetch(`${BINANCE_BASE_URL}/sapi/v1/capital/deposit/hisrec?${signedQuery}`, {
      headers: { 'X-MBX-APIKEY': creds.apiKey },
      signal: AbortSignal.timeout(10000),
    });

    const data = await res.json();

    if (res.ok && Array.isArray(data)) {
      return {
        success: true,
        count: data.length,
        deposits: data.map((d) => ({
          id: d.id,
          amount: parseFloat(d.amount),
          coin: d.coin,
          network: d.network,
          status: d.status, // 1 = Success
          statusText: d.status === 1 ? 'Success' : d.status === 0 ? 'Pending' : 'Credited',
          address: d.address,
          addressTag: d.addressTag,
          txId: d.txId,
          insertTime: d.insertTime,
          insertDate: new Date(d.insertTime),
          transferType: d.transferType === 0 ? 'External Blockchain' : 'Binance Internal Transfer',
        })),
      };
    }

    return {
      success: false,
      message: data.msg || 'Failed to fetch deposit history from Binance',
      code: data.code,
      deposits: [],
    };
  } catch (err) {
    return {
      success: false,
      message: `Binance network exception: ${err.message}`,
      deposits: [],
    };
  }
};

/**
 * Verify customer-submitted TxID against official Binance deposit records
 */
export const verifyBinanceDeposit = async ({ txId, expectedAmount, coin = 'USDT', tolerance = 0.05 }) => {
  if (!txId || typeof txId !== 'string') {
    return { verified: false, message: 'Invalid or missing Transaction ID (TxID)' };
  }

  const cleanTxId = txId.trim();
  const historyRes = await fetchBinanceDepositHistory({ coin, status: 1, limit: 100 });

  if (!historyRes.success) {
    return {
      verified: false,
      message: historyRes.message || 'Unable to connect to Binance deposit ledger',
      canRetry: true,
    };
  }

  const matchedDeposit = historyRes.deposits.find(
    (d) => d.txId && d.txId.toLowerCase().trim() === cleanTxId.toLowerCase()
  );

  if (!matchedDeposit) {
    return {
      verified: false,
      message: `Transaction ID "${cleanTxId}" not found in verified Binance deposit history. Please ensure transaction has completed on blockchain.`,
      notFoundInBinance: true,
    };
  }

  // Check amount
  const depositAmount = parseFloat(matchedDeposit.amount);
  const targetAmount = parseFloat(expectedAmount);

  if (depositAmount < targetAmount - tolerance) {
    return {
      verified: false,
      message: `Deposit amount (${depositAmount} ${matchedDeposit.coin}) is less than expected total (${targetAmount} ${coin}).`,
      matchedDeposit,
      amountMismatch: true,
    };
  }

  return {
    verified: true,
    message: `Binance deposit verified: ${depositAmount} ${matchedDeposit.coin} on ${matchedDeposit.network} network.`,
    deposit: matchedDeposit,
  };
};

