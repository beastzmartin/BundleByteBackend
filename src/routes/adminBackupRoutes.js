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
import { authorize } from '../middleware/roles.js';

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

router.get('/backup/export', protect, authorize('admin', 'super_admin'), exportBackup);
router.get('/backup/snapshots', protect, authorize('admin', 'super_admin'), getBackupSnapshots);
router.get('/backup/snapshots/:filename/download', protect, authorize('admin', 'super_admin'), downloadBackupSnapshot);
router.delete('/backup/snapshots/:filename', protect, authorize('admin', 'super_admin'), deleteBackupSnapshot);
router.post('/backup/create-snapshot', protect, authorize('admin', 'super_admin'), createBackupSnapshot);
router.post('/backup/import/validate', protect, authorize('admin', 'super_admin'), upload.single('file'), validateImport);
router.post('/backup/import/execute', protect, authorize('admin', 'super_admin'), upload.single('file'), executeImport);

export default router;

