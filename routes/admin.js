const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');
const User = require('../models/User');
const Assignment = require('../models/Assignment');

// ── Get dashboard stats ──
router.get('/stats', adminAuth, async (req, res) => {
  try {
    const professions = ['Student', 'Banker', 'EPAYBILLZ Agent', 'Coordinator'];

    const stats = await Promise.all(
      professions.map(async (p) => ({
        profession: p,
        count: await User.countDocuments({ profession: p })
      }))
    );

    const totalUsers       = await User.countDocuments();
    const totalAssignments = await Assignment.countDocuments();
    const recentUsers      = await User.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .select('name email profession createdAt');

    // Registrations per day for last 14 days
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

    res.json({ stats, totalUsers, totalAssignments, recentUsers, last14 });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── Search users ──
router.get('/users/search', adminAuth, async (req, res) => {
  try {
    const query = req.query.q || '';
    const users = await User.find({
      $or: [
        { name:  { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } }
      ]
    })
    .sort({ createdAt: -1 })
    .limit(20)
    .select('name email profession createdAt');

    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ── Delete user ──
router.delete('/users/:id', adminAuth, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    await Assignment.deleteMany({ userId: req.params.id });
    res.json({ message: 'User and their tasks deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ── Export all users as JSON (frontend converts to CSV) ──
router.get('/users/export', adminAuth, async (req, res) => {
  try {
    const users = await User.find()
      .sort({ createdAt: -1 })
      .select('name email profession createdAt');
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;