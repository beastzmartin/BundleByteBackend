import { getTelegramBotToken } from './telegramAuthService.js';
import User from '../models/User.js';

/**
 * Dispatch an outbound Telegram message via Telegram Bot API
 * @param {string|number} chatId Telegram user ID / chat ID
 * @param {string} text Message in Markdown or plain text
 * @param {object} options Extra params (parse_mode, reply_markup, etc.)
 */
export const sendTelegramMessage = async (chatId, text, options = {}) => {
  try {
    const botToken = await getTelegramBotToken();
    if (!botToken || !chatId || !text) return false;

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const payload = {
      chat_id: chatId,
      text,
      parse_mode: options.parse_mode || 'HTML',
      disable_web_page_preview: options.disable_web_page_preview !== false,
      ...options,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    return result.ok === true;
  } catch (error) {
    console.error('Failed to send Telegram message:', error.message);
    return false;
  }
};

/**
 * Send an Order Confirmation notification to a Telegram-connected user
 */
export const notifyOrderUpdate = async (userId, order) => {
  try {
    const user = await User.findById(userId);
    if (!user?.telegramId || !user.telegramNotifications?.orderUpdates) return false;

    const msg = `🛒 <b>BundleByte Order Update</b>\n\n` +
      `Order <b>#${order.orderNumber || order._id}</b> is now <b>${order.orderStatus || 'Processing'}</b>.\n` +
      `Amount: ₹${order.totalAmount || 0}\n` +
      `Payment Status: <b>${order.paymentStatus || 'Pending'}</b>\n\n` +
      `View details in your dashboard at any time.`;

    return await sendTelegramMessage(user.telegramId, msg);
  } catch (err) {
    console.error('Error dispatching Telegram order notification:', err.message);
    return false;
  }
};

/**
 * Send a Product Delivery notification (e.g. keys/accounts ready)
 */
export const notifyDelivery = async (userId, itemTitle) => {
  try {
    const user = await User.findById(userId);
    if (!user?.telegramId || !user.telegramNotifications?.deliveryAlerts) return false;

    const msg = `⚡ <b>Digital Delivery Ready!</b>\n\n` +
      `Your item <b>${itemTitle}</b> has been delivered to your secure vault.\n\n` +
      `Access your activation credentials anytime under <b>Purchased Vault</b>.`;

    return await sendTelegramMessage(user.telegramId, msg);
  } catch (err) {
    console.error('Error dispatching Telegram delivery notification:', err.message);
    return false;
  }
};

/**
 * Send a Support Ticket update notification
 */
export const notifySupportTicket = async (userId, ticket) => {
  try {
    const user = await User.findById(userId);
    if (!user?.telegramId || !user.telegramNotifications?.ticketUpdates) return false;

    const msg = `💬 <b>Support Ticket Update</b>\n\n` +
      `Ticket <b>#${ticket.ticketNumber || ticket._id}</b>: <i>${ticket.subject}</i>\n` +
      `Status: <b>${ticket.status}</b>\n\n` +
      `Our team has updated your request.`;

    return await sendTelegramMessage(user.telegramId, msg);
  } catch (err) {
    console.error('Error dispatching Telegram support notification:', err.message);
    return false;
  }
};

