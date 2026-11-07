import mongoose from 'mongoose';

const teamInvitationSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'Invitee email is required'],
      lowercase: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Invitee name is required'],
      trim: true,
    },
    role: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TeamRole',
      required: [true, 'Invited role is required'],
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      default: null,
    },
    jobTitle: {
      type: String,
      default: 'Team Member',
      trim: true,
    },
    reportingManager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'cancelled', 'expired'],
      default: 'pending',
      index: true,
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    acceptedAt: {
      type: Date,
      default: null,
    },
    acceptedUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('TeamInvitation', teamInvitationSchema);

