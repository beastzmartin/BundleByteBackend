import mongoose from 'mongoose';

const accountImportBatchSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    importedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    fileName: {
      type: String,
      default: 'bulk-accounts-import',
    },
    sourceType: {
      type: String,
      enum: ['txt', 'csv', 'xlsx', 'paste', 'manual'],
      default: 'paste',
    },
    delimiter: {
      type: String,
      default: ':',
    },
    totalDetected: {
      type: Number,
      default: 0,
    },
    validCount: {
      type: Number,
      default: 0,
    },
    duplicateCount: {
      type: Number,
      default: 0,
    },
    invalidCount: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['preview', 'completed', 'cancelled'],
      default: 'completed',
      index: true,
    },
    invalidRecords: [
      {
        line: Number,
        raw: String,
        reason: String,
      },
    ],
    summaryNotes: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('AccountImportBatch', accountImportBatchSchema);

