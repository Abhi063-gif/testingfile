const nodemailer = require('nodemailer');
require('dotenv').config();  // Make sure you have a .env file with your email credentials

const sendEmail = async ({ recipient, subject, html, attachments, text }) => {
  try {
    console.log("\n[MAILER] Starting email send process");
    console.log("[MAILER] Recipient:", recipient);
    console.log("[MAILER] Subject:", subject);
    console.log("[MAILER] Gmail user:", process.env.GMAIL_USER);
    
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      port: 465,
      secure: true,
      auth: {
        user: process.env.GMAIL_USER,  // Your Gmail address
        pass: process.env.GMAIL_PASS,  // Your Gmail password (use app password if 2FA is enabled)
      },
    });
    console.log("[MAILER] Transporter created successfully");

    const mailOptions = {
      from: `<${process.env.GMAIL_USER}>`,  // Sender address
      to: recipient,
      subject: subject,
      html: html,
      attachments: attachments,
      text: text,  // Optional field for plain text version of the email
    };
    console.log("[MAILER] Mail options configured");
    console.log("[MAILER] Sending email...");

    let info = await transporter.sendMail(mailOptions);
    console.log("[MAILER] Email sent successfully!");
    console.log('Email response: ' + info.response);
  } catch (error) {
    console.log("[MAILER] ERROR sending email:");
    console.log(error);
  }
};

exports.sendEmail = async (args) => {
  console.log("[MAILER] sendEmail called");
  console.log("[MAILER] NODE_ENV:", process.env.NODE_ENV);
  
  if (process.env.NODE_ENV === 'development') {
    console.log("[MAILER] Development mode - skipping actual email send");
    return Promise.resolve();
  } else {
    console.log("[MAILER] Production mode - sending actual email");
    return sendEmail(args);
  }
};
