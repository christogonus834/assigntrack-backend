const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Assignment = require('../models/Assignment');

// Add assignment
router.post('/', auth, async (req, res) => {
  try {
    const { courseCode, title, dueDate, submissionLocation } = req.body;
    const assignment = await Assignment.create({
      userId: req.user.id, courseCode, title, dueDate, submissionLocation
    });
    res.json(assignment);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all assignments for logged-in user
router.get('/', auth, async (req, res) => {
  try {
    const assignments = await Assignment.find({ userId: req.user.id }).sort({ dueDate: 1 });
    res.json(assignments);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Mark as complete ← NEW
router.patch('/:id/complete', auth, async (req, res) => {
  try {
    const assignment = await Assignment.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { completed: true },
      { new: true }
    );
    if (!assignment) return res.status(404).json({ message: 'Task not found' });
    res.json(assignment);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Unmark as complete ← NEW
router.patch('/:id/uncomplete', auth, async (req, res) => {
  try {
    const assignment = await Assignment.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { completed: false },
      { new: true }
    );
    res.json(assignment);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete assignment
router.delete('/:id', auth, async (req, res) => {
  try {
    await Assignment.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;