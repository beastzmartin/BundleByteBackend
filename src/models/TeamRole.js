import mongoose from 'mongoose';

const teamRoleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Role name is required'],
      trim: true,
      maxlength: [80, 'Role name cannot exceed 80 characters'],
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    permissions: {
      type: [String],
      default: [],
    },
    isSystemRole: {
      type: Boolean,
      default: false,
    },
    isProtected: {
      type: Boolean,
      default: false, // super_admin / owner cannot be modified or deleted
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('TeamRole', teamRoleSchema);

