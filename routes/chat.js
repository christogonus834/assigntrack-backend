const express      = require('express');
const router       = express.Router();
const Chat         = require('../models/Chat');
const AssignedTask = require('../models/AssignedTask');
const auth         = require('../middleware/auth');

// ── GET messages for a task ──
router.get('/:taskId', auth, async (req, res) => {
  try {
    // Verify user is part of this task
    const task = await AssignedTask.findById(req.params.taskId);
    if (!task) return res.status(404).json({ message: 'Task not found.' });

    const isParticipant =
      task.assignedBy.toString() === req.user.id ||
      task.assignedTo.toString() === req.user.id;

    if (!isParticipant) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    const messages = await Chat.find({ taskId: req.params.taskId })
      .sort({ createdAt: 1 })
      .limit(100);

    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST send a message ──
router.post('/:taskId', auth, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ message: 'Message cannot be empty.' });
    }

    const task = await AssignedTask.findById(req.params.taskId);
    if (!task) return res.status(404).json({ message: 'Task not found.' });

    const isParticipant =
      task.assignedBy.toString() === req.user.id ||
      task.assignedTo.toString() === req.user.id;

    if (!isParticipant) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    const chat = await Chat.create({
      taskId:     req.params.taskId,
      senderId:   req.user.id,
      senderName: req.user.name,
      message:    message.trim()
    });

    res.status(201).json(chat);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;