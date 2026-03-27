const cron = require('node-cron');
const nodemailer = require('nodemailer');
const Assignment = require('../models/Assignment');
require('dotenv').config();

// Create Gmail transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Verify email connection on startup
transporter.verify((error) => {
  if (error) {
    console.error(' Email setup error:', error.message);
  } else {
    console.log(' Email service ready (Gmail)');
  }
});

// Send reminder email helper
async function sendReminderEmail(userEmail, userName, task) {
  const dueFormatted = new Date(task.dueDate).toLocaleString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long',
    day: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  const mailOptions = {
    from: `"AssignTrack 📋" <${process.env.EMAIL_FROM}>`,
    to: userEmail,
    subject: `⏰ 24hr Reminder: "${task.title}" is due soon!`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Segoe UI', sans-serif; background: #0a0e1a; color: #f0f4ff; margin: 0; padding: 0; }
          .container { max-width: 560px; margin: 40px auto; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; overflow: hidden; }
          .header { background: linear-gradient(135deg, #3b82f6, #06b6d4); padding: 32px; text-align: center; }
          .header h1 { margin: 0; font-size: 1.6rem; color: white; }
          .header p { margin: 6px 0 0; color: rgba(255,255,255,0.8); font-size: 0.9rem; }
          .body { padding: 32px; }
          .body h2 { font-size: 1.1rem; color: #93c5fd; margin-bottom: 20px; }
          .task-box { background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); border-radius: 12px; padding: 20px; margin: 20px 0; }
          .task-box h3 { margin: 0 0 12px; color: #fca5a5; font-size: 1rem; }
          .task-row { display: flex; margin-bottom: 8px; font-size: 0.9rem; }
          .task-label { color: #8892a4; width: 120px; flex-shrink: 0; }
          .task-value { color: #f0f4ff; font-weight: 500; }
          .badge { display: inline-block; background: rgba(239,68,68,0.2); color: #fca5a5; border: 1px solid rgba(239,68,68,0.4); padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; margin-bottom: 16px; }
          .footer { text-align: center; padding: 20px 32px; border-top: 1px solid rgba(255,255,255,0.08); color: #8892a4; font-size: 0.8rem; }
          .footer a { color: #3b82f6; text-decoration: none; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📋 AssignTrack</h1>
            <p>Your deadline reminder</p>
          </div>
          <div class="body">
            <h2>Hi ${userName} 👋</h2>
            <p style="color:#8892a4;">You have a task due in <strong style="color:#fca5a5;">less than 24 hours.</strong> Don't miss it!</p>
            <span class="badge">🔴 Due in 24 hours</span>
            <div class="task-box">
              <h3>📌 ${task.title}</h3>
              <div class="task-row">
                <span class="task-label">Course:</span>
                <span class="task-value">${task.courseCode}</span>
              </div>
              <div class="task-row">
                <span class="task-label">Due Date:</span>
                <span class="task-value">${dueFormatted}</span>
              </div>
              <div class="task-row">
                <span class="task-label">Submit via:</span>
                <span class="task-value">${task.submissionLocation}</span>
              </div>
            </div>
            <p style="color:#8892a4;font-size:0.9rem;">Log in to your dashboard to view all your tasks and stay on track.</p>
          </div>
          <div class="footer">
            <p>© 2026 AssignTrack — Built by <a href="#">Drix Tech</a></p>
            <p>You're receiving this because you registered on AssignTrack.</p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  await transporter.sendMail(mailOptions);
}

// Cron job — runs every hour
cron.schedule('0 * * * *', async () => {
  console.log('⏰ Running reminder check...');

  try {
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const in25h = new Date(now.getTime() + 25 * 60 * 60 * 1000);

    const upcoming = await Assignment.find({
      dueDate: { $gte: in24h, $lte: in25h },
      reminderSent: false
    }).populate('userId', 'name email');

    if (!upcoming.length) {
      console.log(' No reminders to send right now.');
      return;
    }

    for (const task of upcoming) {
      const user = task.userId;
      try {
        await sendReminderEmail(user.email, user.name, task);
        await Assignment.findByIdAndUpdate(task._id, { reminderSent: true });
        console.log(`📧 Reminder sent to ${user.email} for "${task.title}"`);
      } catch (emailErr) {
        console.error(` Failed to send to ${user.email}:`, emailErr.message);
      }
    }

  } catch (err) {
    console.error(' Reminder job error:', err.message);
  }
});

console.log('📅 Reminder cron job scheduled (runs every hour)');