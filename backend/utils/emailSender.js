// /utils/emailSender.js
// Nodemailer-based certificate email delivery

const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

// ─────────────────────────────────────────────────────────────────
// TRANSPORTER SETUP
// ─────────────────────────────────────────────────────────────────
function createTransporter() {
  // Supports Gmail, SMTP, and Mailtrap (dev)
  const service = process.env.EMAIL_SERVICE || 'gmail';

  if (service === 'smtp') {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  if (service === 'mailtrap') {
    return nodemailer.createTransport({
      host: 'sandbox.smtp.mailtrap.io',
      port: 2525,
      auth: {
        user: process.env.MAILTRAP_USER,
        pass: process.env.MAILTRAP_PASS,
      },
    });
  }

  // Default: Gmail
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS, // App password for Gmail
    },
  });
}

// ─────────────────────────────────────────────────────────────────
// HTML EMAIL TEMPLATE
// ─────────────────────────────────────────────────────────────────
function buildEmailHtml({ participantName, eventName, certificateId, collegeName, issuedDate }) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <style>
    body { font-family: Georgia, serif; margin: 0; padding: 0; background: #f4f4f4; }
    .container { max-width: 600px; margin: 30px auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #8B1A1A, #C2410C); padding: 30px; text-align: center; }
    .header h1 { color: #fff; margin: 0; font-size: 22px; letter-spacing: 1px; }
    .header p { color: rgba(255,255,255,0.8); margin: 5px 0 0; font-size: 13px; }
    .body { padding: 30px; }
    .greeting { font-size: 16px; color: #333; margin-bottom: 15px; }
    .cert-box { background: #FFF8F0; border-left: 4px solid #C2410C; padding: 18px 20px; margin: 20px 0; border-radius: 0 6px 6px 0; }
    .cert-box .event { font-size: 15px; color: #7C2D12; font-weight: bold; margin-bottom: 6px; }
    .cert-box .meta { font-size: 13px; color: #666; }
    .cert-id { font-family: monospace; font-size: 12px; color: #999; background: #f9f9f9; padding: 6px 10px; border-radius: 4px; display: inline-block; margin-top: 10px; }
    .note { font-size: 13px; color: #555; line-height: 1.7; margin: 15px 0; }
    .footer { background: #f9f9f9; padding: 18px 30px; text-align: center; font-size: 12px; color: #999; border-top: 1px solid #eee; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎓 Certificate of Participation</h1>
      <p>${collegeName || 'Institution\'s Innovation Council'}</p>
    </div>
    <div class="body">
      <div class="greeting">Dear <strong>${participantName}</strong>,</div>
      <p class="note">
        We are delighted to present you with your Certificate of Participation.
        Please find your certificate attached to this email.
      </p>
      <div class="cert-box">
        <div class="event">📋 ${eventName}</div>
        <div class="meta">Issued on: ${issuedDate}</div>
        <div class="cert-id">Certificate ID: ${certificateId}</div>
      </div>
      <p class="note">
        This certificate acknowledges your valuable participation and contribution
        to the event. We hope the experience was enriching and beneficial for your
        academic and professional journey.
      </p>
      <p class="note">
        If you have any queries, please contact the IIC office.
      </p>
    </div>
    <div class="footer">
      This is an auto-generated email. Please do not reply to this message.<br/>
      © ${new Date().getFullYear()} ${collegeName}
    </div>
  </div>
</body>
</html>
`;
}

// ─────────────────────────────────────────────────────────────────
// MAIN: sendCertificateEmail
// ─────────────────────────────────────────────────────────────────
/**
 * Send certificate email with PDF attachment.
 * @param {object} params
 * @param {string} params.to               - Recipient email
 * @param {string} params.participantName  - Full name
 * @param {string} params.eventName        - Event title
 * @param {string} params.certificateId    - Certificate ID string
 * @param {string} [params.pdfPath]        - Path to PDF file (if saved to disk)
 * @param {Buffer} [params.pdfBuffer]      - PDF buffer (alternative to path)
 * @param {string} [params.collegeName]    - College name for email branding
 */
async function sendCertificateEmail({
  to,
  participantName,
  eventName,
  certificateId,
  pdfPath,
  pdfBuffer,
  collegeName,
}) {
  const transporter = createTransporter();
  const issuedDate = new Date().toLocaleDateString('en-IN', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  // Resolve PDF attachment
  let attachmentContent;
  const attachmentFilename = `Certificate_${(participantName || 'Participant').replace(/\s+/g, '_')}.pdf`;

  if (pdfBuffer) {
    attachmentContent = pdfBuffer;
  } else if (pdfPath && fs.existsSync(pdfPath)) {
    attachmentContent = fs.readFileSync(pdfPath);
  } else {
    throw new Error('No PDF content provided. Supply either pdfPath or pdfBuffer.');
  }

  const mailOptions = {
    from: `"${collegeName || process.env.COLLEGE_NAME || 'IIC'}" <${process.env.EMAIL_USER}>`,
    to,
    subject: `Your Certificate of Participation — ${eventName}`,
    html: buildEmailHtml({ participantName, eventName, certificateId, collegeName, issuedDate }),
    attachments: [
      {
        filename: attachmentFilename,
        content: attachmentContent,
        contentType: 'application/pdf',
      },
    ],
  };

  const info = await transporter.sendMail(mailOptions);
  return { messageId: info.messageId, accepted: info.accepted };
}

/**
 * Send bulk email using queue-like approach with delay to avoid rate limits.
 * @param {Array<object>} emailJobs - Array of sendCertificateEmail param objects
 * @param {number} delayMs - Delay between emails in ms (default: 500ms)
 */
async function sendBulkCertificateEmails(emailJobs, delayMs = 500) {
  const results = [];

  for (const job of emailJobs) {
    try {
      const result = await sendCertificateEmail(job);
      results.push({ to: job.to, status: 'sent', messageId: result.messageId });
    } catch (err) {
      results.push({ to: job.to, status: 'failed', error: err.message });
    }
    // Rate limit protection
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }

  return results;
}

module.exports = { sendCertificateEmail, sendBulkCertificateEmails };