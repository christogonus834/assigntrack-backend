const express  = require('express');
const router   = express.Router();
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const User     = require('../models/User');
const auth     = require('../middleware/auth');

// ── Register ──
router.post('/register', async (req, res) => {
  try {
    const {
      name, email, password, phone,
      profession, rank, organization
    } = req.body;

    if (!name || !email || !password || !profession) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: 'Email already registered.' });
    }

    const hashed = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password:     hashed,
      phone:        phone || '',
      profession,
      rank:         profession === 'Chicken Republic' ? (rank || '') : '',
      organization: profession === 'Chicken Republic' ? (organization || '') : '',
    });

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      user: {
        id:           user._id,
        name:         user.name,
        email:        user.email,
        phone:        user.phone,
        profession:   user.profession,
        rank:         user.rank,
        organization: user.organization,
        isAdmin:      user.isAdmin
      }
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Login ──
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid email or password.' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(400).json({ message: 'Invalid email or password.' });
    }

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id:           user._id,
        name:         user.name,
        email:        user.email,
        phone:        user.phone,
        profession:   user.profession,
        rank:         user.rank,
        organization: user.organization,
        isAdmin:      user.isAdmin
      }
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET Profile ──
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── PUT Update Profile ──
router.put('/profile', auth, async (req, res) => {
  try {
    const { name, phone, organization } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { name, phone, organization },
      { new: true }
    ).select('-password');
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── PUT Change Password ──
router.put('/change-password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id);

    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) {
      return res.status(400).json({ message: 'Current password is incorrect.' });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    res.json({ message: 'Password changed successfully.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET Ping (keep server warm) ──
router.get('/ping', (req, res) => {
  res.json({ status: 'ok' });
});

// ── PATCH Grant rank to a user (admin or manager granting to subordinate) ──
router.patch('/grant-rank/:userId', auth, async (req, res) => {
  try {
    const { rank } = req.body;
    const me       = await User.findById(req.user.id);
    const target   = await User.findById(req.params.userId);

    if (!target) return res.status(404).json({ message: 'User not found.' });

    const RANK_GRANTS = {
      'Regional Manager':   'Area Manager',
      'Area Manager':       'Restaurant Manager',
      'Restaurant Manager': 'Assistant Restaurant Manager'
    };

    // Super admin can grant Regional Manager
    if (me.isAdmin) {
      if (rank !== 'Regional Manager') {
        return res.status(403).json({ message: 'As admin you can only grant Regional Manager rank.' });
      }
    } else {
      // Manager can only grant the rank directly below them
      const allowed = RANK_GRANTS[me.rank];
      if (!allowed || rank !== allowed) {
        return res.status(403).json({
          message: `You can only grant the rank of ${allowed || 'no one'}.`
        });
      }
    }

    target.rank      = rank;
    target.grantedBy = me._id;
    await target.save();

    res.json({
      message: `${target.name} has been granted the rank of ${rank}.`,
      user:    target
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;