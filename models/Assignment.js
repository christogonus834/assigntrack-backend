const mongoose = require('mongoose');

const assignmentSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  courseCode:         { type: String, required: true },
  title:              { type: String, required: true },
  dueDate:            { type: Date, required: true },
  submissionLocation: { type: String, required: true },
  reminderSent:       { type: Boolean, default: false },
  completed:          { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Assignment', assignmentSchema);