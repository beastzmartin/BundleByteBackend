import mongoose from 'mongoose';

const supportSLASchema = new mongoose.Schema(
  {
    priority: {
      type: String,
      required: true,
      unique: true,
      enum: ['low', 'normal', 'high', 'urgent'],
    },
    name: {
      type: String,
      required: true,
    },
    firstResponseTargetMinutes: {
      type: Number,
      required: true,
      default: 60,
    },
    resolutionTargetMinutes: {
      type: Number,
      required: true,
      default: 1440, // 24 hours
    },
    autoEscalate: {
      type: Boolean,
      default: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('SupportSLA', supportSLASchema);
