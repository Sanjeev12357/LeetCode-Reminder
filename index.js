const express = require('express');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(express.json());

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log('Connected to MongoDB');
}).catch((err) => {
  console.error('MongoDB connection error:', err);
});

// Reminder Schema and Model
const ReminderSchema = new mongoose.Schema({
  email: String,
  problemUrl: String,
  scheduledFor: Date,
  sent: {
    type: Boolean,
    default: false,
  },
});

const Reminder = mongoose.model('Reminder', ReminderSchema);

// Nodemailer transporter
const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: 587,
  secure: false,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

// Helper function to calculate delay time
const getDelayTime = (reminderTime) => {
  const value = parseInt(reminderTime, 10);
  const now = new Date();
  switch (reminderTime.slice(-1)) {
    case 'm':
      return new Date(now.getTime() + value * 60 * 1000);
    case 'h':
      return new Date(now.getTime() + value * 60 * 60 * 1000);
    case 'd':
      return new Date(now.getTime() + value * 24 * 60 * 60 * 1000);
    default:
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
  }
};

// Set Reminder API
app.post('/api/set-reminder', async (req, res) => {
  const { email, problemUrl, reminderTime } = req.body;

  try {
    // Send confirmation email
    const confirmationMail = {
      from: process.env.MAIL_USER,
      to: email,
      subject: 'LeetCode Reminder Confirmation',
      html: `
        <h2>Your LeetCode Reminder has been set!</h2>
        <p>We'll remind you about this problem:</p>
        <p><a href="${problemUrl}">${problemUrl}</a></p>
        <p>Keep coding!</p>
      `,
    };

    await transporter.sendMail(confirmationMail);

    // Store reminder in the database
    const scheduledFor = getDelayTime(reminderTime);
    const reminder = new Reminder({
      email,
      problemUrl,
      scheduledFor,
    });

    await reminder.save();

    res.json({
      success: true,
      message: 'Reminder set successfully',
    });
  } catch (error) {
    console.error('Error setting reminder:', error);
    res.status(500).json({ error: 'Failed to set reminder' });
  }
});

// Check Reminders API (Cron Job)
app.post('/api/check-reminders', async (req, res) => {
    console.log('CRON_SECRET:', process.env.CRON_SECRET);

  if (req.headers['x-cron-secret'] !== "Sanjeev") {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const dueReminders = await Reminder.find({
      scheduledFor: { $lte: new Date() },
      sent: false,
    });

    for (const reminder of dueReminders) {
      const mailOptions = {
        from: process.env.MAIL_USER,
        to: reminder.email,
        subject: 'LeetCode Problem Reminder',
        html: `
          <h2>Time to solve your LeetCode problem!</h2>
          <p>Here's your reminder to solve this problem:</p>
          <p><a href="${reminder.problemUrl}">${reminder.problemUrl}</a></p>
          <p>Happy coding!</p>
        `,
      };

      await transporter.sendMail(mailOptions);
      reminder.sent = true;
      await reminder.save();
    }

    res.json({ success: true, processedReminders: dueReminders.length });
  } catch (error) {
    console.error('Error processing reminders:', error);
    res.status(500).json({ error: 'Failed to process reminders' });
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
