const express  = require('express');
const router   = express.Router();
const cloudinary = require('cloudinary').v2;
const multer   = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const Post     = require('../models/Post');
const Comment  = require('../models/Comment');
const auth     = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');

// ── Cloudinary config ──
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ── Multer storage for images ──
const imageStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'assigntrack-blog/images',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
    transformation: [{ width: 1200, crop: 'limit', quality: 'auto' }]
  }
});

// ── Multer storage for audio ──
const audioStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'assigntrack-blog/audio',
    allowed_formats: ['mp3', 'wav', 'ogg', 'm4a'],
    resource_type: 'video' // Cloudinary uses 'video' for audio too
  }
});

const uploadImage = multer({ storage: imageStorage });
const uploadAudio = multer({ storage: audioStorage });

// ──────────────────────────────────────────────
// PUBLIC ROUTES
// ──────────────────────────────────────────────

// GET all published posts (with pagination)
router.get('/', async (req, res) => {
  try {
    const page     = parseInt(req.query.page)  || 1;
    const limit    = parseInt(req.query.limit) || 9;
    const category = req.query.category || '';
    const search   = req.query.search   || '';

    const query = { published: true };
    if (category) query.category = category;
    if (search)   query.$or = [
      { title:   { $regex: search, $options: 'i' } },
      { excerpt: { $regex: search, $options: 'i' } },
      { tags:    { $in: [new RegExp(search, 'i')] } }
    ];

    const total = await Post.countDocuments(query);
    const posts = await Post.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select('-content'); // Don't send full content in list

    res.json({
      posts,
      total,
      pages: Math.ceil(total / limit),
      currentPage: page
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET single post by slug + increment views
router.get('/:slug', async (req, res) => {
  try {
    const post = await Post.findOneAndUpdate(
      { slug: req.params.slug, published: true },
      { $inc: { views: 1 } },
      { new: true }
    );
    if (!post) return res.status(404).json({ message: 'Post not found' });

    // Get approved comments
    const comments = await Comment.find({ postId: post._id, approved: true })
      .sort({ createdAt: -1 });

    res.json({ post, comments });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST add comment
router.post('/:id/comments', async (req, res) => {
  try {
    const { name, email, message } = req.body;
    if (!name || !email || !message) {
      return res.status(400).json({ message: 'All fields are required.' });
    }
    const comment = await Comment.create({
      postId: req.params.id,
      name, email, message
    });
    res.status(201).json(comment);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ──────────────────────────────────────────────
// ADMIN ROUTES (protected)
// ──────────────────────────────────────────────

// GET all posts for admin (including unpublished)
router.get('/admin/all', adminAuth, async (req, res) => {
  try {
    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .select('-content');
    res.json(posts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST create post
router.post('/', adminAuth, async (req, res) => {
  try {
    const { title, excerpt, content, category, tags, videoUrl, author, published } = req.body;

    // Generate unique slug
    let slug = title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();

    // Check for duplicate slug
    const existing = await Post.findOne({ slug });
    if (existing) slug = `${slug}-${Date.now()}`;

    const post = await Post.create({
      title, slug, excerpt, content, category,
      tags: tags ? tags.split(',').map(t => t.trim()) : [],
      videoUrl, author, published
    });

    res.status(201).json(post);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST upload thumbnail
router.post('/:id/thumbnail', adminAuth, uploadImage.single('thumbnail'), async (req, res) => {
  try {
    const post = await Post.findByIdAndUpdate(
      req.params.id,
      {
        thumbnail:   req.file.path,
        thumbnailId: req.file.filename
      },
      { new: true }
    );
    res.json({ thumbnail: post.thumbnail });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST upload audio
router.post('/:id/audio', adminAuth, uploadAudio.single('audio'), async (req, res) => {
  try {
    const post = await Post.findByIdAndUpdate(
      req.params.id,
      {
        audio:   req.file.path,
        audioId: req.file.filename
      },
      { new: true }
    );
    res.json({ audio: post.audio });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT update post
router.put('/:id', adminAuth, async (req, res) => {
  try {
    const { title, excerpt, content, category, tags, videoUrl, author, published } = req.body;
    const post = await Post.findByIdAndUpdate(
      req.params.id,
      {
        title, excerpt, content, category,
        tags: tags ? tags.split(',').map(t => t.trim()) : [],
        videoUrl, author, published
      },
      { new: true }
    );
    res.json(post);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE post + Cloudinary cleanup
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });

    // Delete media from Cloudinary
    if (post.thumbnailId) {
      await cloudinary.uploader.destroy(post.thumbnailId);
    }
    if (post.audioId) {
      await cloudinary.uploader.destroy(post.audioId, { resource_type: 'video' });
    }

    await Post.findByIdAndDelete(req.params.id);
    await Comment.deleteMany({ postId: req.params.id });

    res.json({ message: 'Post deleted successfully.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE comment (admin)
router.delete('/:postId/comments/:commentId', adminAuth, async (req, res) => {
  try {
    await Comment.findByIdAndDelete(req.params.commentId);
    res.json({ message: 'Comment deleted.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET blog stats for admin dashboard
router.get('/admin/stats', adminAuth, async (req, res) => {
  try {
    const totalPosts    = await Post.countDocuments();
    const totalViews    = await Post.aggregate([
      { $group: { _id: null, total: { $sum: '$views' } } }
    ]);
    const totalComments = await Comment.countDocuments();
    const topPosts      = await Post.find()
      .sort({ views: -1 })
      .limit(5)
      .select('title views slug createdAt');

    const byCategory = await Post.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    res.json({
      totalPosts,
      totalViews:    totalViews[0]?.total || 0,
      totalComments,
      topPosts,
      byCategory
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;