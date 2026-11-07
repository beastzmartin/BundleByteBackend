import crypto from 'crypto';
import https from 'https';
import http from 'http';
import { decryptCredential } from '../../utils/credentialEncryption.js';

/**
 * Generate standard Paytm HMAC-SHA256 Checksum Signature
 * @param {Object|string} params
 * @param {string} key
 * @returns {string} Base64 signature
 */
export const generatePaytmSignature = (params, key) => {
  try {
    let dataString = '';
    if (typeof params === 'string') {
      dataString = params;
    } else if (params && typeof params === 'object') {
      // Sort keys alphabetically
      const sortedKeys = Object.keys(params).sort();
      dataString = sortedKeys
        .filter((k) => k !== 'CHECKSUMHASH' && k !== 'signature' && params[k] !== undefined && params[k] !== null)
        .map((k) => `${k}=${params[k]}`)
        .join('|');
    }

    const hmac = crypto.createHmac('sha256', key);
    hmac.update(dataString);
    return hmac.digest('base64');
  } catch (error) {
    console.error('Error generating Paytm signature:', error);
    return '';
  }
};

/**
 * Verify Paytm Checksum Signature
 * @param {Object|string} params
 * @param {string} key
 * @param {string} checksum
 * @returns {boolean}
 */
export const verifyPaytmSignature = (params, key, checksum) => {
  if (!checksum || !key) return false;
  try {
    const expected = generatePaytmSignature(params, key);
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(checksum));
  } catch (error) {
    // If lengths differ or error occurs
    const expected = generatePaytmSignature(params, key);
    return expected === checksum;
  }
};

/**
 * Generate standard UPI dynamic payment URI
 * Example: upi://pay?pa=merchant@paytm&am=499.00&pn=Merchant+Name&tn=Order+123&tr=BB-PTM-1234
 */
export const generateUpiPaymentUri = ({ upiId, merchantName, amount, txnRef, remark }) => {
  const cleanUpi = upiId.trim();
  const cleanName = encodeURIComponent((merchantName || 'BundleByte Merchant').trim());
  const cleanAmount = Number(amount).toFixed(2);
  const cleanRef = encodeURIComponent(txnRef.trim());
  const cleanRemark = encodeURIComponent(remark.trim());

  return `upi://pay?pa=${cleanUpi}&pn=${cleanName}&am=${cleanAmount}&cu=INR&tn=${cleanRemark}&tr=${cleanRef}`;
};

/**
 * Generate Paytm Mobile Intent Deep Link
 * Allows direct opening in Paytm Cash Wallet app on mobile devices
 */
export const generatePaytmIntentDeepLink = ({ upiId, merchantName, amount, txnRef, remark }) => {
  const cleanUpi = upiId.trim();
  const cleanName = encodeURIComponent((merchantName || 'BundleByte Merchant').trim());
  const cleanAmount = Number(amount).toFixed(2);
  const cleanRef = encodeURIComponent(txnRef.trim());
  const cleanRemark = encodeURIComponent(remark.trim());

  return `paytmmp://cash_wallet?pa=${cleanUpi}&am=${cleanAmount}&pn=${cleanName}&tn=${cleanRemark}&tr=${cleanRef}&mc=5641&cu=INR&mode=02&purpose=00&orgid=159002&featuretype=money_transfer`;
};

/**
 * Generate high-res Dynamic QR Code URL for UPI payload
 */
export const generateQrCodeUrl = (upiUri) => {
  return `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(upiUri)}&size=280x280&ecc=M&margin=1`;
};

/**
 * Perform HTTPS GET/POST helper with timeout
 */
const fetchJsonWithTimeout = (url, options = {}, timeoutMs = 8000) => {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https');
    const client = isHttps ? https : http;

    const req = client.request(url, options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve(parsed);
        } catch (e) {
          resolve({ rawText: body, status: res.statusCode });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.setTimeout(timeoutMs, () => {
      req.destroy();
      reject(new Error(`Request timed out after ${timeoutMs}ms`));
    });

    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }

    req.end();
  });
};

/**
 * Query Paytm Order Status API
 * Follows the official Paytm Order Status API workflow
 *
 * @param {Object} options
 * @param {string} options.mid - Merchant ID
 * @param {string} options.merchantKey - Encrypted or raw merchant key
 * @param {string} options.orderId - Paytm Transaction Reference / Order ID
 * @param {string} options.environment - 'production' | 'staging'
 * @returns {Promise<Object>} Formatted status result
 */
export const queryPaytmOrderStatus = async ({ mid, merchantKey, orderId, environment = 'production' }) => {
  const decryptedKey = merchantKey && merchantKey.includes(':') ? decryptCredential(merchantKey) : merchantKey;

  const baseUrl =
    environment === 'staging' ? 'https://securegw-stage.paytm.in' : 'https://securegw.paytm.in';

  const jsonData = JSON.stringify({
    MID: mid,
    ORDERID: orderId,
  });

  const encodedJson = encodeURIComponent(jsonData);
  const statusUrl = `${baseUrl}/order/status?JsonData=${encodedJson}`;

  try {
    const response = await fetchJsonWithTimeout(statusUrl, { method: 'GET' }, 8000);

    // Official response fields:
    // STATUS: 'TXN_SUCCESS' | 'TXN_FAILURE' | 'PENDING'
    // TXNID: Paytm transaction ID
    // BANKTXNID: Bank UTR / Reference ID
    // TXNAMOUNT: Amount paid
    // ORDERID: Order ID
    // MID: Merchant ID
    // GATEWAYNAME: Gateway used (UPI / WALLET)
    // RESPCODE: Response code (01 is success)
    // RESPMSG: Response message
    // CHECKSUMHASH: Signature

    if (response && response.STATUS) {
      const isSuccess = response.STATUS === 'TXN_SUCCESS' && (response.RESPCODE === '01' || response.RESPCODE === '1');

      // Paytm returns RESPCODE 334 ("Invalid Order Id.") or empty TXNID when the user has not completed payment yet
      const isNotYetPaid =
        response.RESPCODE === '334' ||
        response.RESPCODE === '400' ||
        response.RESPCODE === '401' ||
        response.RESPCODE === '402' ||
        response.RESPCODE === '227' ||
        (response.RESPMSG && response.RESPMSG.toLowerCase().includes('invalid order')) ||
        (!response.TXNID && response.STATUS !== 'TXN_SUCCESS');

      // A failure is ONLY genuine if Paytm has a recorded transaction that was declined by the bank
      const isFailed = response.STATUS === 'TXN_FAILURE' && !isNotYetPaid && Boolean(response.TXNID);
      const isPending = !isSuccess && !isFailed;

      return {
        success: true,
        rawStatus: response.STATUS,
        normalizedStatus: isSuccess ? 'TXN_SUCCESS' : isFailed ? 'TXN_FAILURE' : 'PENDING',
        isSuccess,
        isPending,
        isFailed,
        txnId: response.TXNID || '',
        bankTxnId: response.BANKTXNID || '', // Bank UTR
        amount: response.TXNAMOUNT ? parseFloat(response.TXNAMOUNT) : null,
        orderId: response.ORDERID || orderId,
        mid: response.MID || mid,
        gatewayName: response.GATEWAYNAME || 'UPI',
        paymentMode: response.PAYMENTMODE || '',
        responseMessage: response.RESPMSG || '',
        responseCode: response.RESPCODE || '',
        rawResponse: response,
      };
    }

    // In local development / test without external connectivity:
    return {
      success: false,
      normalizedStatus: 'PENDING',
      isSuccess: false,
      isPending: true,
      isFailed: false,
      responseMessage: response?.rawText || 'Unable to parse Paytm response',
      rawResponse: response,
    };
  } catch (error) {
    return {
      success: false,
      normalizedStatus: 'PENDING',
      isSuccess: false,
      isPending: true,
      isFailed: false,
      errorMessage: error.message,
    };
  }
};

