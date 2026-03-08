const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  title:       { type: String, required: true, trim: true },
  slug:        { type: String, required: true, unique: true },
  excerpt:     { type: String, required: true, maxlength: 300 },
  content:     { type: String, required: true },
  category:    {
    type: String,
    required: true,
    enum: [
      'Productivity & Tasks',
      'Student Life',
      'Finance & Banking',
      'EPAYBILLZ News',
      'Tech & Apps',
      'Sports',
      'How to Make Money Online'
    ]
  },
  tags:        [{ type: String, trim: true }],
  thumbnail:   { type: String, default: '' },
  thumbnailId: { type: String, default: '' },
  audio:       { type: String, default: '' },
  audioId:     { type: String, default: '' },
  videoUrl:    { type: String, default: '' },
  author:      { type: String, default: 'Drix Tech' },
  views:       { type: Number, default: 0 },
  published:   { type: Boolean, default: true },
}, { timestamps: true });

// Auto-generate slug from title
postSchema.pre('validate', function (next) {
  if (this.title && !this.slug) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }
  next();
});

module.exports = mongoose.model('Post', postSchema);