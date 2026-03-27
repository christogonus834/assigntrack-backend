const mongoose = require('mongoose');

const assignedTaskSchema = new mongoose.Schema({
  assignedBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assignedByName: { type: String, required: true },
  assignedByRank: { type: String, required: true },
  assignedTo:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assignedToName: { type: String, required: true },
  assignedToRank: { type: String, required: true },
  title:          { type: String, required: true },
  description:    { type: String, default: '' },
  dueDate:        { type: Date, required: true },
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Urgent'],
    default: 'Medium'
  },
  completed:    { type: Boolean, default: false },
  completedAt:  { type: Date, default: null },
  reminderSent: { type: Boolean, default: false },
  notified:     { type: Boolean, default: false },
  organization: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('AssignedTask', assignedTaskSchema);