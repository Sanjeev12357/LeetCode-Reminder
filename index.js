const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const dotenv = require('dotenv');

// Configure dotenv at the start
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Verify that environment variables are loaded
console.log('Mail configuration:', {
  host: process.env.MAIL_HOST,
  user: process.env.MAIL_USER,
  hasPassword: !!process.env.MAIL_PASS
});

// Create transporter with verification
const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: 587,
  secure: false,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  }
});

// Verify transporter configuration
transporter.verify(function(error, success) {
  if (error) {
    console.error('Transporter verification failed:', error);
  } else {
    console.log('Server is ready to send emails');
  }
});

const getDelayTime = (reminderTime) => {
  const value = parseInt(reminderTime);
  switch(reminderTime.slice(-1)) {
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default: return 24 * 60 * 60 * 1000;
  }
};

// Helper function to format delay time for human reading
const formatDelayForHuman = (reminderTime) => {
  const value = parseInt(reminderTime);
  switch(reminderTime.slice(-1)) {
    case 'm': return `${value} minute${value > 1 ? 's' : ''}`;
    case 'h': return `${value} hour${value > 1 ? 's' : ''}`;
    case 'd': return `${value} day${value > 1 ? 's' : ''}`;
    default: return '1 day';
  }
};

app.post('/api/set-reminder', async (req, res) => {
  const { email, problemUrl, reminderTime } = req.body;

  try {
    // Send immediate confirmation email
    const confirmationMailOptions = {
      from: process.env.MAIL_USER,
      to: email,
      subject: 'LeetCode Reminder Confirmation',
      html: `
        <h2>Your LeetCode Reminder has been set!</h2>
        <p>We'll remind you about this problem in ${formatDelayForHuman(reminderTime)}:</p>
        <p><a href="${problemUrl}">${problemUrl}</a></p>
        <p>Keep coding!</p>
        <br>
        <p style="color: #666; font-size: 0.9em;">If you didn't set this reminder, please ignore this email.</p>
      `
    };

    // Send confirmation email immediately
    await transporter.sendMail(confirmationMailOptions);
    console.log('Confirmation email sent successfully');

    // Create reminder mail options
    const reminderMailOptions = {
      from: process.env.MAIL_USER,
      to: email,
      subject: 'Time to Solve Your LeetCode Problem!',
      html: `
        <h2>Time to solve your LeetCode problem!</h2>
        <p>As requested ${formatDelayForHuman(reminderTime)} ago, here's your reminder to solve this problem:</p>
        <p><a href="${problemUrl}">${problemUrl}</a></p>
        <p>Happy coding!</p>
        <br>
        <p style="color: #666; font-size: 0.9em;">If you've already solved this problem, great job!</p>
      `
    };

    // Schedule the reminder email
    const delay = getDelayTime(reminderTime);
    
    // Use Promise to handle the delayed email sending
    const sendDelayedEmail = new Promise((resolve, reject) => {
      setTimeout(async () => {
        try {
          const info = await transporter.sendMail(reminderMailOptions);
          console.log('Reminder email sent successfully:', info.messageId);
          resolve(info);
        } catch (error) {
          console.error('Error sending reminder email:', error);
          reject(error);
        }
      }, delay);
    });

    // Start the email sending process
    sendDelayedEmail
      .then(() => console.log(`Reminder scheduled for ${delay}ms from now`))
      .catch(error => console.error('Failed to schedule reminder:', error));

    // Respond immediately that both emails have been handled
    res.json({ 
      success: true, 
      message: `Confirmation email sent and reminder scheduled for ${formatDelayForHuman(reminderTime)} from now`
    });

  } catch (error) {
    console.error('Error in email process:', error);
    res.status(500).json({ 
      error: 'Failed to process emails',
      message: error.message
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});