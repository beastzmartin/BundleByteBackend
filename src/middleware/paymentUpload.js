import multer from 'multer';
import path from 'path';
import fs from 'fs';

let receiptsDir = path.resolve(process.cwd(), 'uploads/receipts');
let qrDir = path.resolve(process.cwd(), 'uploads/qrcodes');

try {
  if (!fs.existsSync(receiptsDir)) {
    fs.mkdirSync(receiptsDir, { recursive: true });
  }
  if (!fs.existsSync(qrDir)) {
    fs.mkdirSync(qrDir, { recursive: true });
  }
} catch (e) {
  receiptsDir = path.resolve('/tmp', 'uploads/receipts');
  qrDir = path.resolve('/tmp', 'uploads/qrcodes');
  try {
    if (!fs.existsSync(receiptsDir)) fs.mkdirSync(receiptsDir, { recursive: true });
    if (!fs.existsSync(qrDir)) fs.mkdirSync(qrDir, { recursive: true });
  } catch (_) {}
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const isQr = req.query.type === 'qr' || req.body.uploadType === 'qr';
    const targetDir = isQr ? qrDir : receiptsDir;
    try {
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
    } catch (_) {}
    cb(null, targetDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const prefix = req.query.type === 'qr' ? 'qr' : 'receipt';
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${prefix}-${uniqueSuffix}${ext}`);
  },
});

const allowedMimeTypes = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
];

const fileFilter = (req, file, cb) => {
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file type: ${file.mimetype}. Allowed: JPG, PNG, WEBP, GIF, PDF`), false);
  }
};

export const paymentUpload = multer({
  storage,
  limits: {
    fileSize: 8 * 1024 * 1024, // 8MB limit
    files: 1,
  },
  fileFilter,
});
