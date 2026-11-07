import mongoose from 'mongoose';

const permissionOverrideSchema = new mongoose.Schema(
  {
    permissionKey: {
      type: String,
      required: true,
      trim: true,
    },
    effect: {
      type: String,
      enum: ['allow', 'deny'],
      required: true,
    },
    grantedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reason: {
      type: String,
      default: '',
      trim: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const teamMemberSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    employeeCode: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    jobTitle: {
      type: String,
      default: 'Team Member',
      trim: true,
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      default: null,
    },
    roles: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'TeamRole',
      },
    ],
    reportingManager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    status: {
      type: String,
      enum: ['active', 'invited', 'suspended', 'deactivated'],
      default: 'active',
      index: true,
    },
    directPermissionOverrides: [permissionOverrideSchema],
    resourceScopes: {
      departments: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Department',
        },
      ],
      assignedOnly: {
        type: Boolean,
        default: false,
      },
    },
    suspendedReason: {
      type: String,
      default: '',
    },
    suspendedAt: {
      type: Date,
      default: null,
    },
    suspendedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    lastActiveAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('TeamMember', teamMemberSchema);

