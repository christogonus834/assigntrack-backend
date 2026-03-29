const cron       = require('node-cron');
const nodemailer = require('nodemailer');
const Assignment = require('../models/Assignment');
const AssignedTask = require('../models/AssignedTask');
const User       = require('../models/User');
const termii     = require('./termii');

console.log('📅 Reminder cron job scheduled (runs every hour)');

// ── Email transporter ──
function createTransporter() {
  return nodemailer.createTransport({
    host:   process.env.EMAIL_HOST || 'smtp-relay.brevo.com',
    port:   parseInt(process.env.EMAIL_PORT) || 587,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
}

// ── Send Email ──
async function sendEmail(toEmail, toName, subject, taskTitle, dueDate, submissionLocation) {
  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from:    '"AssignTrack" <' + process.env.EMAIL_FROM + '>',
      to:      toEmail,
      subject: subject,
      html:
        '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f8faff;padding:24px;border-radius:12px;">' +
          '<h2 style="color:#3b82f6;">⏰ Task Due Soon!</h2>' +
          '<p>Hi <strong>' + toName + '</strong>,</p>' +
          '<p>Your task <strong>' + taskTitle + '</strong> is due in less than 24 hours!</p>' +
          '<div style="background:#fff;border-left:4px solid #3b82f6;padding:16px;border-radius:8px;margin:16px 0;">' +
            '<p style="margin:0;"><strong>Task:</strong> ' + taskTitle + '</p>' +
            '<p style="margin:8px 0 0;"><strong>Due:</strong> ' + new Date(dueDate).toLocaleString('en-US', {weekday:'long',year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'}) + '</p>' +
            (submissionLocation ? '<p style="margin:8px 0 0;"><strong>Submit via:</strong> ' + submissionLocation + '</p>' : '') +
          '</div>' +
          '<a href="https://www.assign.epaybillz.com.ng/pages/dashboard.html" style="background:#3b82f6;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;">View Dashboard →</a>' +
          '<p style="color:#94a3b8;font-size:0.85rem;margin-top:24px;">AssignTrack — Built by Drix Tech</p>' +
        '</div>'
    });
    console.log('✅ Email sent to', toEmail);
  } catch (err) {
    console.error('❌ Email error:', err.message);
  }
}

// ── CRON: runs every hour ──
cron.schedule('0 * * * *', async () => {
  console.log('🔔 Running reminder check...');

  const now      = new Date();
  const in24h    = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  try {
    // ── 1. Personal assignments reminder ──
    const personalTasks = await Assignment.find({
      dueDate:      { $gte: now, $lte: in24h },
      reminderSent: false,
      completed:    false
    });

    for (const task of personalTasks) {
      const user = await User.findById(task.userId);
      if (!user) continue;

      // Email
      await sendEmail(
        user.email,
        user.name,
        '⏰ Reminder: "' + task.title + '" is due soon!',
        task.title,
        task.dueDate,
        task.submissionLocation
      );

      // SMS + WhatsApp
      await termii.sendTaskDueReminder(user, task);

      task.reminderSent = true;
      await task.save();
    }

    // ── 2. Assigned tasks reminder (to assignee) ──
    const assignedTasks = await AssignedTask.find({
      dueDate:      { $gte: now, $lte: in24h },
      reminderSent: false,
      completed:    false
    });

    for (const task of assignedTasks) {
      // Remind the person the task is assigned TO
      const assignee = await User.findById(task.assignedTo);
      if (assignee) {
        await sendEmail(
          assignee.email,
          assignee.name,
          '⏰ Task Due Soon: "' + task.title + '"',
          task.title,
          task.dueDate,
          null
        );
        await termii.sendAssignedTaskDueReminder(assignee, task, task.assignedByName);
      }

      // Also remind the person who assigned it
      const assigner = await User.findById(task.assignedBy);
      if (assigner) {
        await sendEmail(
          assigner.email,
          assigner.name,
          '⏰ Task you assigned is due: "' + task.title + '"',
          task.title,
          task.dueDate,
          null
        );
        await termii.sendTaskDueReminder(assigner, task);
      }

      task.reminderSent = true;
      await task.save();
    }

    const total = personalTasks.length + assignedTasks.length;
    if (total === 0) {
      console.log('No reminders to send right now.');
    } else {
      console.log('✅ Sent ' + total + ' reminder(s) via Email + SMS + WhatsApp.');
    }

  } catch (err) {
    console.error('❌ Reminder job error:', err.message);
  }
});