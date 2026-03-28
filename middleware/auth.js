const jwt  = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token, access denied' });
    }

    const token   = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch fresh user data so name is always available
    const user = await User.findById(decoded.id).select('-password');
    if (!user) return res.status(401).json({ message: 'User not found.' });

    req.user = {
      id:           user._id.toString(),
      name:         user.name,
      email:        user.email,
      profession:   user.profession,
      rank:         user.rank,
      organization: user.organization,
      isAdmin:      user.isAdmin
    };

    next();
  } catch (err) {
    res.status(401).json({ message: 'Token invalid or expired.' });
  }
};