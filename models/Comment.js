const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  postId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
  name:     { type: String, required: true, trim: true, maxlength: 80 },
  email:    { type: String, required: true, trim: true },
  message:  { type: String, required: true, trim: true, maxlength: 1000 },
  approved: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Comment', commentSchema);