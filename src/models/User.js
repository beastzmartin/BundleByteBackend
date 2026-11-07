import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const adminNoteSchema = new mongoose.Schema(
  {
    note: {
      type: String,
      required: true,
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    authorName: {
      type: String,
      default: 'Admin',
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide a name'],
      trim: true,
      maxlength: [60, 'Name cannot exceed 60 characters'],
    },
    email: {
      type: String,
      required: [true, 'Please provide an email address'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email address'],
      index: true,
    },
    password: {
      type: String,
      required: function () {
        // Password required only for local auth without an external OAuth/Identity provider
        if ((this.googleId || this.telegramId) && (!this.authProviders || !this.authProviders.includes('local'))) {
          return false;
        }
        return !this.googleId && !this.telegramId;
      },
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,
    },
    googleId: {
      type: String,
      default: null,
      sparse: true,
      index: true,
    },
    googleEmail: {
      type: String,
      default: '',
      trim: true,
      lowercase: true,
    },
    googleProfile: {
      sub: { type: String, default: '' },
      name: { type: String, default: '' },
      picture: { type: String, default: '' },
      emailVerified: { type: Boolean, default: false },
    },
    telegramId: {
      type: String,
      default: null,
      sparse: true,
      index: true,
    },
    telegramUsername: {
      type: String,
      default: '',
      trim: true,
    },
    telegramConnectedAt: {
      type: Date,
      default: null,
    },
    telegramProfile: {
      id: { type: String, default: '' },
      firstName: { type: String, default: '' },
      lastName: { type: String, default: '' },
      username: { type: String, default: '' },
      photoUrl: { type: String, default: '' },
      authDate: { type: Date, default: null },
    },
    telegramNotifications: {
      enabled: { type: Boolean, default: false },
      orderUpdates: { type: Boolean, default: true },
      deliveryAlerts: { type: Boolean, default: true },
      subscriptionAlerts: { type: Boolean, default: true },
      ticketUpdates: { type: Boolean, default: true },
    },
    authProviders: {
      type: [String],
      enum: ['local', 'google', 'telegram'],
      default: ['local'],
    },
    registrationMethod: {
      type: String,
      enum: ['local', 'google', 'telegram', 'admin'],
      default: 'local',
    },
    loginHistory: [
      {
        provider: { type: String, default: 'local' },
        ip: { type: String, default: '' },
        userAgent: { type: String, default: '' },
        timestamp: { type: Date, default: Date.now },
        success: { type: Boolean, default: true },
        location: { type: String, default: '' },
      },
    ],
    role: {
      type: String,
      default: 'customer',
      index: true,
    },
    websitePermissions: {
      type: [String],
      enum: [
        'website_manager',
        'branding_manager',
        'popup_manager',
        'banner_manager',
        'seo_manager',
      ],
      default: [],
    },
    avatar: {
      type: String,
      default: '',
    },
    phone: {
      type: String,
      default: '',
    },
    // Account state & controls
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isSuspended: {
      type: Boolean,
      default: false,
      index: true,
    },
    suspendedReason: {
      type: String,
      default: '',
    },
    suspendedAt: {
      type: Date,
      default: null,
    },
    isBanned: {
      type: Boolean,
      default: false,
      index: true,
    },
    bannedReason: {
      type: String,
      default: '',
    },
    bannedAt: {
      type: Date,
      default: null,
    },
    forcePasswordReset: {
      type: Boolean,
      default: false,
    },
    tokenVersion: {
      type: Number,
      default: 0,
      index: true,
    },
    // Security & Authentication protections
    failedLoginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: {
      type: Date,
      default: null,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
    lastLoginIp: {
      type: String,
      default: '',
    },
    mfaEnabled: {
      type: Boolean,
      default: false,
    },
    mfaSecret: {
      type: String,
      select: false,
    },
    // Email verification & communications
    isEmailVerified: {
      type: Boolean,
      default: true,
    },
    emailVerificationToken: {
      type: String,
      default: null,
    },
    emailVerificationExpire: {
      type: Date,
      default: null,
    },
    optInAnnouncements: {
      type: Boolean,
      default: true,
    },
    // Admin issued account notes
    adminNotes: [adminNoteSchema],
    // Billing
    billingAddress: {
      company: { type: String, default: '' },
      street: { type: String, default: '' },
      city: { type: String, default: '' },
      state: { type: String, default: '' },
      zipCode: { type: String, default: '' },
      country: { type: String, default: 'US' },
    },
    resetPasswordToken: String,
    resetPasswordExpire: Date,
  },
  {
    timestamps: true,
  }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  if (!this.password) return false;
  return await bcrypt.compare(enteredPassword, this.password);
};

export default mongoose.model('User', userSchema);
