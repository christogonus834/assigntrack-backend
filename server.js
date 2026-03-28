const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');
const dotenv   = require('dotenv');

dotenv.config();
require('./utils/reminderJob');

const app = express();

app.use(cors({
  origin: [
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    'http://localhost:5173',
    'https://assign.epaybillz.com.ng',
    'https://www.assign.epaybillz.com.ng',
    'https://blog.epaybillz.com.ng',
    'https://www.blog.epaybillz.com.ng'
  ],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// ── Routes ──
app.use('/api/auth',           require('./routes/auth'));
app.use('/api/assignments',    require('./routes/assignments'));
app.use('/api/admin',          require('./routes/admin'));
app.use('/api/posts',          require('./routes/posts'));
app.use('/api/assigned-tasks', require('./routes/assignedTasks'));
app.use('/api/chat',           require('./routes/chat'));

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB Connected');
    app.listen(process.env.PORT || 5000, () => {
      console.log(`🚀 Server running on port ${process.env.PORT || 5000}`);
    });
  })
  .catch(err => console.error('❌ MongoDB error:', err.message));