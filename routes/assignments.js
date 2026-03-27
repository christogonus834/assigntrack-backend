const express    = require('express');
const router     = express.Router();
const Assignment = require('../models/Assignment');
const auth       = require('../middleware/auth');

// ── GET all assignments for logged-in user ──
router.get('/', auth, async (req, res) => {
  try {
    const assignments = await Assignment.find({ userId: req.user.id })
      .sort({ dueDate: 1 });
    res.json(assignments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST create new assignment ──
router.post('/', auth, async (req, res) => {
  try {
    const { courseCode, title, dueDate, submissionLocation } = req.body;

    if (!courseCode || !title || !dueDate || !submissionLocation) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    const assignment = await Assignment.create({
      userId: req.user.id,
      courseCode,
      title,
      dueDate,
      submissionLocation
    });

    res.status(201).json(assignment);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── PATCH mark as complete ──
router.patch('/:id/complete', auth, async (req, res) => {
  try {
    const assignment = await Assignment.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { completed: true },
      { new: true }
    );
    if (!assignment) return res.status(404).json({ message: 'Assignment not found.' });
    res.json(assignment);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── PATCH mark as incomplete ──
router.patch('/:id/uncomplete', auth, async (req, res) => {
  try {
    const assignment = await Assignment.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { completed: false },
      { new: true }
    );
    if (!assignment) return res.status(404).json({ message: 'Assignment not found.' });
    res.json(assignment);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── DELETE assignment ──
router.delete('/:id', auth, async (req, res) => {
  try {
    const assignment = await Assignment.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id
    });
    if (!assignment) return res.status(404).json({ message: 'Assignment not found.' });
    res.json({ message: 'Assignment deleted.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;