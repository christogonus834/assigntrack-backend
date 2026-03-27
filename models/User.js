const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name:     { type: String, required: true },
  email:    { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone:    { type: String, default: '' },

  profession: {
    type: String,
    required: true,
    enum: [
      'Student',
      'Banker',
      'EPAYBILLZ Agent',
      'Coordinator',
      'Chicken Republic'
    ]
  },

  // Chicken Republic hierarchy
  rank: {
    type: String,
    enum: [
      '',
      'Regional Manager',
      'Area Manager',
      'Restaurant Manager',
      'Assistant Restaurant Manager'
    ],
    default: ''
  },
  organization: { type: String, default: '' },
  grantedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  // ── Subscription ──
  subscriptionPlan: {
    type: String,
    enum: ['free', 'pro'],
    default: 'free'
  },
  subscriptionStatus: {
    type: String,
    enum: ['free', 'active', 'expired'],
    default: 'free'
  },
  subscriptionStart:  { type: Date, default: null },
  subscriptionExpiry: { type: Date, default: null },

  isAdmin: { type: Boolean, default: false }

}, { timestamps: true });

// ── Virtual: check if subscription is active ──
userSchema.virtual('isPro').get(function() {
  if (this.subscriptionPlan === 'free') return false;
  if (!this.subscriptionExpiry) return false;
  return new Date() < new Date(this.subscriptionExpiry);
});

module.exports = mongoose.model('User', userSchema);