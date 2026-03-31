const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name:       { type: String, required: true },
  email:      { type: String, required: true, unique: true },
  password:   { type: String, required: true },
  phone:      { type: String, default: '' },
  profilePic: { type: String, default: '' },

  profession: {
    type: String,
    required: true,
    enum: ['Student','Banker','EPAYBILLZ Agent','Coordinator','Chicken Republic']
  },

  // Chicken Republic rank
  rank: {
    type: String,
    enum: [
      '',
      'Pending',
      'Regional Manager',
      'Area Manager',
      'Restaurant Manager',
      'Assistant Restaurant Manager'
    ],
    default: ''
  },

  // Rank approval status
  rankStatus: {
    type: String,
    enum: ['none', 'pending', 'approved', 'rejected'],
    default: 'none'
  },

  // Requested rank (what they picked at registration)
  requestedRank: { type: String, default: '' },

  organization: { type: String, default: '' },
  grantedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  // Subscription
  subscriptionPlan:   { type: String, enum: ['free','pro'], default: 'free' },
  subscriptionStatus: { type: String, enum: ['free','active','expired'], default: 'free' },
  subscriptionStart:  { type: Date, default: null },
  subscriptionExpiry: { type: Date, default: null },

  isAdmin: { type: Boolean, default: false }

}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);