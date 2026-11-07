import nodemailer from 'nodemailer';
import { ENV } from './environment.js';

let transporter = null;

export const initMailer = async () => {
  if (ENV.SMTP_HOST && ENV.SMTP_USER) {
    transporter = nodemailer.createTransport({
      host: ENV.SMTP_HOST,
      port: ENV.SMTP_PORT,
      secure: ENV.SMTP_PORT === 465,
      auth: {
        user: ENV.SMTP_USER,
        pass: ENV.SMTP_PASS,
      },
    });
    console.log('📧 SMTP Mailer configured with host:', ENV.SMTP_HOST);
  } else {
    // Development fallback logger
    transporter = {
      sendMail: async (mailOptions) => {
        console.log('\n================== 📧 OUTGOING EMAIL SIMULATION ==================');
        console.log(`To: ${mailOptions.to}`);
        console.log(`Subject: ${mailOptions.subject}`);
        console.log(`Preview: ${mailOptions.text || '(HTML Content)'}`);
        console.log('===================================================================\n');
        return { messageId: `mock-${Date.now()}` };
      },
    };
    console.log('📧 Email simulator ready (emails will be logged to console)');
  }
};

export const sendMail = async ({ to, subject, html, text }) => {
  if (!transporter) {
    await initMailer();
  }
  return await transporter.sendMail({
    from: `"${ENV.FROM_NAME}" <${ENV.FROM_EMAIL}>`,
    to,
    subject,
    text: text || '',
    html: html || text,
  });
};

export const sendEmail = sendMail;

