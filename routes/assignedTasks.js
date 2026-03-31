const express      = require('express');
const router       = express.Router();
const AssignedTask = require('../models/AssignedTask');
const User         = require('../models/User');
const auth         = require('../middleware/auth');
const nodemailer   = require('nodemailer');
const termii       = require('../utils/termii');

// ── Rank hierarchy — who assigns to whom ──
const CAN_ASSIGN_TO = {
  'Regional Manager':   'Area Manager',
  'Area Manager':       'Restaurant Manager',
  'Restaurant Manager': 'Assistant Restaurant Manager'
};

// ── Email helper ──
async function sendAssignmentEmail(toEmail, toName, fromName, fromRank, task) {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp-relay.brevo.com',
      port: parseInt(process.env.EMAIL_PORT) || 587,
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    });
    await transporter.sendMail({
      from:    '"AssignTrack" <' + process.env.EMAIL_FROM + '>',
      to:      toEmail,
      subject: '📋 New Task Assigned: "' + task.title + '"',
      html:
        '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f8faff;padding:24px;border-radius:12px;">' +
          '<h2 style="color:#3b82f6;">📋 New Task Assigned to You</h2>' +
          '<p>Hi <strong>' + toName + '</strong>,</p>' +
          '<p><strong>' + fromName + '</strong> (' + fromRank + ') has assigned you a new task:</p>' +
          '<div style="background:#fff;border-left:4px solid #3b82f6;padding:16px;border-radius:8px;margin:16px 0;">' +
            '<h3 style="margin:0 0 8px;">' + task.title + '</h3>' +
            (task.description ? '<p style="color:#64748b;margin:0 0 8px;">' + task.description + '</p>' : '') +
            '<p style="margin:0;color:#64748b;"><strong>Due:</strong> ' + new Date(task.dueDate).toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'}) + '</p>' +
            '<p style="margin:8px 0 0;color:#64748b;"><strong>Priority:</strong> ' + task.priority + '</p>' +
          '</div>' +
          '<a href="https://www.assign.epaybillz.com.ng/pages/dashboard.html" style="background:#3b82f6;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;">View Dashboard →</a>' +
          '<p style="color:#94a3b8;font-size:0.85rem;margin-top:24px;">AssignTrack — Built by Drix Tech</p>' +
        '</div>'
    });
  } catch (err) {
    console.error('Email error:', err.message);
  }
}

// ── GET subordinates I can assign to ──
// STRICT: same organization only
router.get('/subordinates', auth, async (req, res) => {
  try {
    const me = await User.findById(req.user.id);

    // Super admin can assign to EPAYBILLZ Agent and Coordinator
    if (me.isAdmin) {
      const users = await User.find({
        profession: { $in: ['EPAYBILLZ Agent', 'Coordinator'] }
      }).select('name email profession rank organization');
      return res.json(users);
    }

    // Must have an approved rank to assign
    if (!me.rank || me.rank === '' || me.rankStatus !== 'approved') {
      return res.json([]);
    }

    const targetRank = CAN_ASSIGN_TO[me.rank];
    if (!targetRank) return res.json([]);

    // STRICT: same organization AND approved rank
    const users = await User.find({
      profession:   'Chicken Republic',
      rank:         targetRank,
      rankStatus:   'approved',
      organization: me.organization  // ← SAME BRANCH ONLY
    }).select('name email profession rank organization');

    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST assign a task ──
router.post('/', auth, async (req, res) => {
  try {
    const { assignedTo, title, description, dueDate, priority } = req.body;

    if (!assignedTo || !title || !dueDate) {
      return res.status(400).json({ message: 'assignedTo, title and dueDate are required.' });
    }

    const me     = await User.findById(req.user.id);
    const target = await User.findById(assignedTo);

    if (!target) return res.status(404).json({ message: 'User not found.' });

    // Validate for non-admin
    if (!me.isAdmin) {
      // Must have approved rank
      if (!me.rank || me.rankStatus !== 'approved') {
        return res.status(403).json({ message: 'Your rank has not been approved yet.' });
      }

      const targetRank = CAN_ASSIGN_TO[me.rank];
      if (!targetRank) {
        return res.status(403).json({ message: 'Your rank cannot assign tasks.' });
      }

      // Must be correct rank
      if (target.rank !== targetRank) {
        return res.status(403).json({
          message: 'You can only assign tasks to ' + targetRank + '.'
        });
      }

      // Must be same organization
      if (me.organization !== target.organization) {
        return res.status(403).json({
          message: 'You can only assign tasks to staff in your own branch/organization.'
        });
      }

      // Target must have approved rank
      if (target.rankStatus !== 'approved') {
        return res.status(403).json({
          message: target.name + '\'s rank has not been approved yet.'
        });
      }
    }

    const task = await AssignedTask.create({
      assignedBy:     me._id,
      assignedByName: me.name,
      assignedByRank: me.rank || me.profession,
      assignedTo:     target._id,
      assignedToName: target.name,
      assignedToRank: target.rank || target.profession,
      title,
      description:  description || '',
      dueDate,
      priority:     priority || 'Medium',
      organization: me.organization || ''
    });

    // Notify via Email + SMS + WhatsApp
    await sendAssignmentEmail(target.email, target.name, me.name, me.rank || me.profession, task);
    await termii.sendTaskAssignedNotification(target, task, me.name, me.rank || me.profession);

    res.status(201).json(task);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET tasks assigned TO me ──
router.get('/tome', auth, async (req, res) => {
  try {
    const tasks = await AssignedTask.find({ assignedTo: req.user.id }).sort({ createdAt: -1 });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET tasks I assigned ──
router.get('/byme', auth, async (req, res) => {
  try {
    const tasks = await AssignedTask.find({ assignedBy: req.user.id }).sort({ createdAt: -1 });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── PATCH complete (only assigner) ──
router.patch('/:id/complete', auth, async (req, res) => {
  try {
    const task = await AssignedTask.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found.' });
    if (task.assignedBy.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Only the assigner can mark this complete.' });
    }
    task.completed = true; task.completedAt = new Date();
    await task.save();
    res.json(task);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── PATCH uncomplete (only assigner) ──
router.patch('/:id/uncomplete', auth, async (req, res) => {
  try {
    const task = await AssignedTask.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found.' });
    if (task.assignedBy.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Only the assigner can update this.' });
    }
    task.completed = false; task.completedAt = null;
    await task.save();
    res.json(task);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── DELETE (only assigner, only if not completed) ──
router.delete('/:id', auth, async (req, res) => {
  try {
    const task = await AssignedTask.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found.' });
    if (task.assignedBy.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Only the assigner can delete this.' });
    }
    await AssignedTask.findByIdAndDelete(req.params.id);
    res.json({ message: 'Task deleted.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;