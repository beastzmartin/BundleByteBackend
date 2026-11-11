import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import {
  exportBackup,
  getBackupSnapshots,
  createBackupSnapshot,
  downloadBackupSnapshot,
  deleteBackupSnapshot,
  validateImport,
  executeImport,
} from '../controllers/adminBackupController.js';
import { protect } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';

let tempUploadDir = path.resolve(process.cwd(), 'uploads/temp');
try {
  if (!fs.existsSync(tempUploadDir)) fs.mkdirSync(tempUploadDir, { recursive: true });
} catch (_) {
  tempUploadDir = path.resolve('/tmp', 'uploads/temp');
  try { if (!fs.existsSync(tempUploadDir)) fs.mkdirSync(tempUploadDir, { recursive: true }); } catch (_) {}
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, tempUploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `import-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
});

const router = express.Router();

router.get('/backup/export', protect, requirePermission('system_settings.manage'), exportBackup);
router.get('/backup/snapshots', protect, requirePermission('system_settings.manage'), getBackupSnapshots);
router.get('/backup/snapshots/:filename/download', protect, requirePermission('system_settings.manage'), downloadBackupSnapshot);
router.delete('/backup/snapshots/:filename', protect, requirePermission('system_settings.manage'), deleteBackupSnapshot);
router.post('/backup/create-snapshot', protect, requirePermission('system_settings.manage'), createBackupSnapshot);
router.post('/backup/import/validate', protect, requirePermission('system_settings.manage'), upload.single('file'), validateImport);
router.post('/backup/import/execute', protect, requirePermission('system_settings.manage'), upload.single('file'), executeImport);

export default router;

