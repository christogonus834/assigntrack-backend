const express    = require('express');
const router     = express.Router();
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const cloudinary = require('cloudinary').v2;
const multer     = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const User       = require('../models/User');
const auth       = require('../middleware/auth');

// ── Cloudinary config ──
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// ── Profile pic storage ──
const picStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder:          'assigntrack-profiles',
    allowed_formats: ['jpg','jpeg','png','webp'],
    transformation:  [{ width:200, height:200, crop:'fill', gravity:'face' }]
  }
});
const uploadPic = multer({ storage: picStorage });

// ── Who can approve whom ──
const APPROVAL_CHAIN = {
  'Regional Manager':              'admin',
  'Area Manager':                  'Regional Manager',
  'Restaurant Manager':            'Area Manager',
  'Assistant Restaurant Manager':  'Restaurant Manager'
};

// ── Register ──
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone, profession, rank, organization } = req.body;

    if (!name || !email || !password || !profession) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: 'Email already registered.' });

    const hashed = await bcrypt.hash(password, 10);

    // For Chicken Republic — rank starts as PENDING, needs approval
    let userRank       = '';
    let rankStatus     = 'none';
    let requestedRank  = '';

    if (profession === 'Chicken Republic' && rank) {
      userRank      = '';           // No active rank yet
      rankStatus    = 'pending';    // Awaiting approval
      requestedRank = rank;         // What they requested
    }

    const user = await User.create({
      name, email,
      password:     hashed,
      phone:        phone || '',
      profession,
      rank:         userRank,
      rankStatus,
      requestedRank,
      organization: profession === 'Chicken Republic' ? (organization||'') : ''
    });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      token,
      user: {
        id:             user._id,
        name:           user.name,
        email:          user.email,
        phone:          user.phone,
        profession:     user.profession,
        rank:           user.rank,
        rankStatus:     user.rankStatus,
        requestedRank:  user.requestedRank,
        organization:   user.organization,
        isAdmin:        user.isAdmin,
        profilePic:     user.profilePic,
        subscriptionPlan:   user.subscriptionPlan,
        subscriptionExpiry: user.subscriptionExpiry
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
    if (!email || !password) return res.status(400).json({ message: 'All fields required.' });

    const user  = await User.findOne({ email });
    if (!user)  return res.status(400).json({ message: 'Invalid email or password.' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ message: 'Invalid email or password.' });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: {
        id:             user._id,
        name:           user.name,
        email:          user.email,
        phone:          user.phone,
        profession:     user.profession,
        rank:           user.rank,
        rankStatus:     user.rankStatus,
        requestedRank:  user.requestedRank,
        organization:   user.organization,
        isAdmin:        user.isAdmin,
        profilePic:     user.profilePic || '',
        subscriptionPlan:   user.subscriptionPlan,
        subscriptionExpiry: user.subscriptionExpiry
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

// ── POST Upload Profile Picture ──
router.post('/profile-pic', auth, uploadPic.single('profilePic'), async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { profilePic: req.file.path },
      { new: true }
    ).select('-password');
    res.json({
      profilePic: user.profilePic,
      message: 'Profile picture updated successfully.'
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── PUT Change Password ──
router.put('/change-password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user  = await User.findById(req.user.id);
    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) return res.status(400).json({ message: 'Current password is incorrect.' });
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    res.json({ message: 'Password changed successfully.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET pending rank approvals (for managers to see who needs approval) ──
router.get('/pending-approvals', auth, async (req, res) => {
  try {
    const me = await User.findById(req.user.id);

    let query = { profession: 'Chicken Republic', rankStatus: 'pending' };

    if (me.isAdmin) {
      // Admin sees only pending Regional Managers
      query.requestedRank = 'Regional Manager';
    } else if (me.rank === 'Regional Manager') {
      // Regional Manager sees pending Area Managers in same org
      query.requestedRank  = 'Area Manager';
      query.organization   = me.organization;
    } else if (me.rank === 'Area Manager') {
      // Area Manager sees pending Restaurant Managers in same org
      query.requestedRank  = 'Restaurant Manager';
      query.organization   = me.organization;
    } else if (me.rank === 'Restaurant Manager') {
      // Restaurant Manager sees pending Assistants in same org
      query.requestedRank  = 'Assistant Restaurant Manager';
      query.organization   = me.organization;
    } else {
      return res.json([]); // No approvals for others
    }

    const pending = await User.find(query).select('-password');
    res.json(pending);

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── PATCH Approve rank ──
router.patch('/approve-rank/:userId', auth, async (req, res) => {
  try {
    const me     = await User.findById(req.user.id);
    const target = await User.findById(req.params.userId);

    if (!target) return res.status(404).json({ message: 'User not found.' });
    if (target.rankStatus !== 'pending') {
      return res.status(400).json({ message: 'No pending rank request for this user.' });
    }

    const requestedRank = target.requestedRank;

    // Validate approver
    const approverRequired = APPROVAL_CHAIN[requestedRank];
    if (approverRequired === 'admin' && !me.isAdmin) {
      return res.status(403).json({ message: 'Only admin can approve Regional Manager.' });
    }
    if (approverRequired !== 'admin' && me.rank !== approverRequired) {
      return res.status(403).json({
        message: 'Only a ' + approverRequired + ' can approve this rank.'
      });
    }

    // Also check same organization (except admin)
    if (!me.isAdmin && me.organization !== target.organization) {
      return res.status(403).json({ message: 'User is not in your organization.' });
    }

    target.rank        = requestedRank;
    target.rankStatus  = 'approved';
    target.grantedBy   = me._id;
    await target.save();

    res.json({
      message: target.name + ' has been approved as ' + requestedRank + '.',
      user:    target
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── PATCH Reject rank ──
router.patch('/reject-rank/:userId', auth, async (req, res) => {
  try {
    const target = await User.findById(req.params.userId);
    if (!target) return res.status(404).json({ message: 'User not found.' });

    target.rankStatus     = 'rejected';
    target.rank           = '';
    target.requestedRank  = '';
    await target.save();

    res.json({ message: target.name + '\'s rank request has been rejected.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET Ping ──
router.get('/ping', (req, res) => res.json({ status: 'ok' }));

module.exports = router;