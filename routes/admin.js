const express    = require('express');
const router     = express.Router();
const User       = require('../models/User');
const Assignment = require('../models/Assignment');
const adminAuth  = require('../middleware/adminAuth');

// ── GET admin stats ──
router.get('/stats', adminAuth, async (req, res) => {
  try {
    const totalUsers       = await User.countDocuments();
    const totalAssignments = await Assignment.countDocuments();

    const stats = await User.aggregate([
      { $group: { _id: '$profession', count: { $sum: 1 } } }
    ]);

    const recentUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(50)
      .select('-password');

    // Last 14 days registrations
    const last14 = [];
    for (let i = 13; i >= 0; i--) {
      const date  = new Date();
      date.setDate(date.getDate() - i);
      const start = new Date(date.setHours(0, 0, 0, 0));
      const end   = new Date(date.setHours(23, 59, 59, 999));
      const count = await User.countDocuments({
        createdAt: { $gte: start, $lte: end }
      });
      last14.push({
        date: start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        count
      });
    }

    res.json({ totalUsers, totalAssignments, stats, recentUsers, last14 });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET all users (with search) ──
router.get('/users', adminAuth, async (req, res) => {
  try {
    const search = req.query.search || '';
    const query  = search
      ? { $or: [
          { name:  { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ]}
      : {};

    const users = await User.find(query)
      .sort({ createdAt: -1 })
      .select('-password');
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── DELETE user ──
router.delete('/users/:id', adminAuth, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    await Assignment.deleteMany({ userId: req.params.id });
    res.json({ message: 'User deleted successfully.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET users export (CSV data) ──
router.get('/users/export', adminAuth, async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── PATCH grant/upgrade subscription (admin only) ──
router.patch('/users/:id/subscription', adminAuth, async (req, res) => {
  try {
    const { plan } = req.body; // 'free' or 'pro'

    if (!['free', 'pro'].includes(plan)) {
      return res.status(400).json({ message: 'Plan must be free or pro.' });
    }

    const now     = new Date();
    const expiry  = new Date();
    expiry.setMonth(expiry.getMonth() + 1); // 1 month from now

    const user = await User.findByIdAndUpdate(
      req.params.id,
      {
        subscriptionPlan:   plan,
        subscriptionStatus: plan === 'pro' ? 'active' : 'free',
        subscriptionExpiry: plan === 'pro' ? expiry : null,
        subscriptionStart:  plan === 'pro' ? now : null
      },
      { new: true }
    ).select('-password');

    if (!user) return res.status(404).json({ message: 'User not found.' });

    res.json({
      message: `User ${user.name} upgraded to ${plan.toUpperCase()} plan.`,
      user
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── PATCH grant rank to Chicken Republic user (admin only) ──
router.patch('/users/:id/rank', adminAuth, async (req, res) => {
  try {
    const { rank } = req.body;

    const validRanks = [
      'Regional Manager',
      'Area Manager',
      'Restaurant Manager',
      'Assistant Restaurant Manager',
      ''
    ];

    if (!validRanks.includes(rank)) {
      return res.status(400).json({ message: 'Invalid rank.' });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { rank },
      { new: true }
    ).select('-password');

    if (!user) return res.status(404).json({ message: 'User not found.' });

    res.json({
      message: `${user.name} has been granted the rank of ${rank || 'None'}.`,
      user
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;