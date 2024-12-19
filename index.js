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
  // Don't log the actual password
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

app.post('/api/set-reminder', async (req, res) => {
  const { email, problemUrl, reminderTime } = req.body;

  try {
    // Create mail options
    const mailOptions = {
      from: process.env.MAIL_USER, // Use environment variable instead of hardcoded email
      to: email,
      subject: 'LeetCode Problem Reminder',
      html: `
        <h2>Time to solve your LeetCode problem!</h2>
        <p>You asked to be reminded about this problem:</p>
        <p><a href="${problemUrl}">${problemUrl}</a></p>
        <p>Happy coding!</p>
      `
    };

    // Schedule the email
    const delay = getDelayTime(reminderTime);
    
    // Use Promise to handle the delayed email sending
    const sendDelayedEmail = new Promise((resolve, reject) => {
      setTimeout(async () => {
        try {
          const info = await transporter.sendMail(mailOptions);
          console.log('Email sent successfully:', info.messageId);
          resolve(info);
        } catch (error) {
          console.error('Error sending email:', error);
          reject(error);
        }
      }, delay);
    });

    // Start the email sending process
    sendDelayedEmail
      .then(() => console.log(`Reminder scheduled for ${delay}ms from now`))
      .catch(error => console.error('Failed to schedule reminder:', error));

    // Respond immediately that the reminder has been scheduled
    res.json({ 
      success: true, 
      message: `Reminder scheduled to be sent in ${delay}ms`
    });

  } catch (error) {
    console.error('Error setting reminder:', error);
    res.status(500).json({ 
      error: 'Failed to set reminder',
      message: error.message
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});