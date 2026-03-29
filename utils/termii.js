const axios = require('axios');

const TERMII_API_KEY  = process.env.TERMII_API_KEY;
const TERMII_SECRET   = process.env.TERMII_SECRET;
const TERMII_SENDER   = process.env.TERMII_SENDER_ID || 'AssignTrack';
const TERMII_BASE_URL = 'https://api.ng.termii.com/api';

// ── Format phone number to international format ──
function formatPhone(phone) {
  if (!phone) return null;
  // Remove spaces, dashes, brackets
  phone = phone.replace(/[\s\-\(\)]/g, '');
  // Convert 0XXXXXXXXXX to 234XXXXXXXXXX
  if (phone.startsWith('0')) {
    phone = '234' + phone.slice(1);
  }
  // Remove + if present
  if (phone.startsWith('+')) {
    phone = phone.slice(1);
  }
  return phone;
}

// ── Send SMS ──
async function sendSMS(phone, message) {
  try {
    const formattedPhone = formatPhone(phone);
    if (!formattedPhone) {
      console.log('SMS skipped: no phone number');
      return;
    }

    const res = await axios.post(`${TERMII_BASE_URL}/sms/send`, {
      to:       formattedPhone,
      from:     TERMII_SENDER,
      sms:      message,
      type:     'plain',
      channel:  'generic',
      api_key:  TERMII_API_KEY
    });

    console.log('✅ SMS sent to', formattedPhone, res.data);
    return res.data;
  } catch (err) {
    console.error('❌ SMS error:', err.response?.data || err.message);
  }
}

// ── Send WhatsApp ──
async function sendWhatsApp(phone, message) {
  try {
    const formattedPhone = formatPhone(phone);
    if (!formattedPhone) {
      console.log('WhatsApp skipped: no phone number');
      return;
    }

    const res = await axios.post(`${TERMII_BASE_URL}/sms/send`, {
      to:       formattedPhone,
      from:     TERMII_SENDER,
      sms:      message,
      type:     'plain',
      channel:  'whatsapp',
      api_key:  TERMII_API_KEY
    });

    console.log('✅ WhatsApp sent to', formattedPhone, res.data);
    return res.data;
  } catch (err) {
    console.error('❌ WhatsApp error:', err.response?.data || err.message);
  }
}

// ── Send Task Assignment Notification (SMS + WhatsApp) ──
async function sendTaskAssignedNotification(user, task, assignerName, assignerRank) {
  const message =
    'AssignTrack Alert!\n' +
    'Hi ' + user.name + ', you have a new task assigned by ' + assignerName + ' (' + assignerRank + ').\n' +
    'Task: ' + task.title + '\n' +
    'Due: ' + new Date(task.dueDate).toLocaleDateString('en-NG', { weekday:'short', month:'short', day:'numeric', year:'numeric' }) + '\n' +
    'Priority: ' + task.priority + '\n' +
    'Login to view: https://www.assign.epaybillz.com.ng';

  if (user.phone) {
    await sendSMS(user.phone, message);
    await sendWhatsApp(user.phone, message);
  }
}

// ── Send Task Due Reminder (SMS + WhatsApp) ──
async function sendTaskDueReminder(user, task) {
  const message =
    'AssignTrack Reminder!\n' +
    'Hi ' + user.name + ', your task is due soon!\n' +
    'Task: ' + task.title + '\n' +
    'Due: ' + new Date(task.dueDate).toLocaleString('en-NG', { weekday:'short', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }) + '\n' +
    'Login to manage: https://www.assign.epaybillz.com.ng';

  if (user.phone) {
    await sendSMS(user.phone, message);
    await sendWhatsApp(user.phone, message);
  }
}

// ── Send Assigned Task Due Reminder ──
async function sendAssignedTaskDueReminder(user, task, assignerName) {
  const message =
    'AssignTrack Reminder!\n' +
    'Hi ' + user.name + ', a task assigned by ' + assignerName + ' is due soon!\n' +
    'Task: ' + task.title + '\n' +
    'Due: ' + new Date(task.dueDate).toLocaleString('en-NG', { weekday:'short', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }) + '\n' +
    'Login: https://www.assign.epaybillz.com.ng';

  if (user.phone) {
    await sendSMS(user.phone, message);
    await sendWhatsApp(user.phone, message);
  }
}

module.exports = {
  sendSMS,
  sendWhatsApp,
  sendTaskAssignedNotification,
  sendTaskDueReminder,
  sendAssignedTaskDueReminder
};