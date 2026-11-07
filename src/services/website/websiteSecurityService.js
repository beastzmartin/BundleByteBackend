import path from 'path';
import fs from 'fs';
import multer from 'multer';

// Sanitize HTML / Rich Text to prevent stored XSS attacks
export const sanitizeHtmlContent = (htmlString) => {
  if (!htmlString || typeof htmlString !== 'string') return '';

  let sanitized = htmlString;

  // 1. Remove script tags and contents
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // 2. Remove dangerous event handlers (onload, onerror, onclick, onmouseover, etc.)
  sanitized = sanitized.replace(/(\s+)on[a-z]+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, '$1');

  // 3. Disarm javascript: pseudo-protocols in href and src
  sanitized = sanitized.replace(/(href|src)\s*=\s*(['"]?)\s*javascript:[^'">]*\2/gi, '$1="#"');

  // 4. Disarm data: URL protocols in src/href (except standard images)
  sanitized = sanitized.replace(/(href|src)\s*=\s*(['"]?)\s*data:(?!image\/)[^'">]*\2/gi, '$1="#"');

  // 5. Strip dangerous iframe, object, embed, form, base, applet tags
  sanitized = sanitized.replace(/<\/?(iframe|object|embed|form|base|applet)\b[^>]*>/gi, '');

  return sanitized.trim();
};

// Configure Multer for secure image uploads
const isServerless = process.env.VERCEL === '1' || Boolean(process.env.AWS_LAMBDA_FUNCTION_VERSION);
let uploadsDir = isServerless
  ? path.resolve('/tmp', 'uploads/website')
  : path.resolve(process.cwd(), 'uploads/website');

try {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
} catch (err) {
  // In serverless environments, process.cwd() is read-only. Fallback to /tmp
  uploadsDir = path.resolve('/tmp', 'uploads/website');
  try {
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
  } catch (_) {}
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
    } catch (_) {
      uploadsDir = path.resolve('/tmp', 'uploads/website');
      if (!fs.existsSync(uploadsDir)) {
        try { fs.mkdirSync(uploadsDir, { recursive: true }); } catch (_) {}
      }
    }
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `site-asset-${uniqueSuffix}${ext}`);
  },
});

const allowedMimeTypes = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/svg+xml',
  'image/x-icon',
  'image/vnd.microsoft.icon',
  'image/gif',
];

const fileFilter = (req, file, cb) => {
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Invalid file type: ${file.mimetype}. Allowed types: JPEG, PNG, WEBP, SVG, GIF, ICO`
      ),
      false
    );
  }
};

export const websiteAssetUpload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 Megabytes
    files: 1,
  },
  fileFilter,
});

