
// /services/certificateService.js
// Core certificate generation service

const fs = require('fs');
const path = require('path');
const moment = require('moment');
const { Certificate, Event, User, Attendance } = require('../models');
const CertificateSettings = require('../models/certificateSettings');
const DEFAULT_CONFIG = require('../config/certificateDefaults');
const { generateUniqueCertificateId } = require('../utils/certificateIdGenerator');
const { htmlToPdf } = require('../utils/pdfGenerator');
const { sendCertificateEmail } = require('../utils/emailSender');

// ─────────────────────────────────────────────────────────────────
// TEMPLATE LOADER - Read raw HTML template from disk
// ─────────────────────────────────────────────────────────────────
function loadTemplate(templateId) {
  const validId = parseInt(templateId);
  if (isNaN(validId) || validId < 1 || validId > 7) {
    throw new Error(`Invalid templateId: ${templateId}. Must be 1–7.`);
  }
  const templatePath = path.join(__dirname, '..', 'templates', `template${validId}.html`);
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template file not found: template${validId}.html`);
  }
  return fs.readFileSync(templatePath, 'utf8');
}

// ─────────────────────────────────────────────────────────────────
// PLACEHOLDER REPLACER - Replace all {{field}} tokens in template
// ─────────────────────────────────────────────────────────────────
function fillPlaceholders(html, data) {
  let result = html;
  for (const [key, value] of Object.entries(data)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(regex, value !== undefined && value !== null ? value : '');
  }
  // Replace any remaining unfilled placeholders with empty string
  result = result.replace(/\{\{[^}]+\}\}/g, '');
  return result;
}

// ─────────────────────────────────────────────────────────────────
// HELPER: Get effective settings for an event
// ─────────────────────────────────────────────────────────────────
async function getEffectiveSettings(eventId) {
  const settings = await CertificateSettings.findOne({ event: eventId }).lean();

  // Merge: Defaults -> Settings -> Overrides
  const config = {
    // 1. System Defaults
    collegeName: DEFAULT_CONFIG.collegeName,
    collegeTagline: DEFAULT_CONFIG.collegeTagline,
    logoLeft: DEFAULT_CONFIG.logoLeft,
    logoRight: DEFAULT_CONFIG.logoRight,

    sig1Name: DEFAULT_CONFIG.sig1Name,
    sig1Title: DEFAULT_CONFIG.sig1Title,
    sig1Url: DEFAULT_CONFIG.sig1Url,

    sig2Name: DEFAULT_CONFIG.sig2Name,
    sig2Title: DEFAULT_CONFIG.sig2Title,
    sig2Url: DEFAULT_CONFIG.sig2Url,

    sig3Name: DEFAULT_CONFIG.sig3Name,
    sig3Title: DEFAULT_CONFIG.sig3Title,
    sig3Url: DEFAULT_CONFIG.sig3Url,

    sig4Name: DEFAULT_CONFIG.sig4Name,
    sig4Title: DEFAULT_CONFIG.sig4Title,
    sig4Url: DEFAULT_CONFIG.sig4Url,

    templateId: 1,
    customFields: {},
  };

  if (settings) {
    // 2. Event Specific Settings
    if (settings.templateId) config.templateId = settings.templateId;
    if (settings.logoLeft) config.logoLeft = settings.logoLeft;
    if (settings.logoRight) config.logoRight = settings.logoRight;

    // Signatures
    if (settings.signatures && settings.signatures.length > 0) {
      settings.signatures.forEach((sig, index) => {
        const num = index + 1;
        if (num > 4) return;
        if (sig.name) config[`sig${num}Name`] = sig.name;
        if (sig.title) config[`sig${num}Title`] = sig.title;
        if (sig.imageUrl) config[`sig${num}Url`] = sig.imageUrl;
      });
    }

    // Custom Fields
    if (settings.customFields) {
      config.customFields = settings.customFields;
    }
  }

  return config;
}

// ─────────────────────────────────────────────────────────────────
// MAIN: generateCertificateHTML
// ─────────────────────────────────────────────────────────────────
async function generateCertificateHTML(eventId, userData, eventData, customFields = {}, certId = null) {
  // 1. Get Settings
  const config = await getEffectiveSettings(eventId);

  // Override template if provided in customFields (for preview)
  const templateId = customFields.templateId || config.templateId;

  // 2. Load Template
  const rawHtml = loadTemplate(templateId);

  // 3. Format Date
  const formattedEventDate = eventData.eventDate
    ? moment(eventData.eventDate).format('DD MMMM YYYY')
    : '';
  const issuedDate = moment().format('DD MMMM YYYY');

  // 4. Resolve Name
  const participantName = userData.fullName
    || `${userData.firstName || ''} ${userData.lastName || ''}`.trim()
    || 'Participant';

  // 5. Generate/Use ID
  const certificateId = certId || await generateUniqueCertificateId(eventData.eventDate, Certificate);

  // 6. Build Placeholders
  const placeholders = {
    ...config, // System defaults + Event Settings

    // Event Data
    eventTitle: eventData.title || '',
    organiserName: eventData.organiserName || config.sig4Name,
    department: userData.department || eventData.department || '',
    venue: eventData.venue || '',
    eventDate: formattedEventDate,
    chiefGuest: eventData.chiefGuest || '',

    // User Data
    participantName,

    // Meta
    certificateId,
    issuedDate,

    // Dynamic Custom Fields
    ...config.customFields, // From settings
    ...customFields,        // From request
  };

  // 7. Inject Signature Images or Lines
  // If sigXUrl is present, <img src="..."> else fallback text/line
  for (let i = 1; i <= 4; i++) {
    const urlKey = `sig${i}Url`;
    const tagKey = `sig${i}ImageTag`;

    // If URL exists, create img tag. Else empty string (template should handle fallback if needed, or we just leave name)
    // NOTE: This assumes templates use {{{sig1ImageTag}}} for safety or we sanitize. 
    // Ideally templates should have <img src="{{sig1Url}}" style="display: {{sig1Display}}">

    if (placeholders[urlKey]) {
      placeholders[`sig${i}Display`] = 'block';
    } else {
      placeholders[`sig${i}Display`] = 'none';
    }
  }

  const html = fillPlaceholders(rawHtml, placeholders);
  return { html, certificateId, templateId };
}

// ─────────────────────────────────────────────────────────────────
// BULK: generateCertificatesForEvent
// ─────────────────────────────────────────────────────────────────
async function generateCertificatesForEvent(eventId, options = {}) {
  const { sendEmail = true, savePdf = true, forceRegenerate = false } = options;

  const event = await Event.findById(eventId).lean();
  if (!event) throw new Error('Event not found');

  // Fetch attendees
  const attendances = await Attendance.find({
    event: eventId,
    status: 'present',
  }).populate('user').lean();

  if (!attendances.length) {
    return { success: false, message: 'No present attendees found', results: [] };
  }

  const outputDir = path.join(__dirname, '..', 'generated_certificates', String(eventId));
  if (savePdf && !fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const results = [];

  for (const attendance of attendances) {
    const user = attendance.user;
    if (!user) continue;

    try {
      // Check if already generated
      let certRecord = await Certificate.findOne({ event: eventId, user: user._id });

      if (certRecord && certRecord.status === 'sent' && !forceRegenerate) {
        results.push({ userId: user._id, status: 'skipped', reason: 'Already sent' });
        continue;
      }

      // Generate HTML
      const { html, certificateId, templateId } = await generateCertificateHTML(
        eventId,
        user,
        event
      );

      // Create/Update PDF
      let pdfPath = '';
      if (savePdf) {
        pdfPath = path.join(outputDir, `${certificateId}.pdf`);
        await htmlToPdf(html, pdfPath);
      }

      // Create/Update DB Record (Pending)
      const now = new Date();
      if (!certRecord) {
        certRecord = await Certificate.create({
          certificateId,
          event: eventId,
          user: user._id,
          templateId,
          pdfPath,
          status: 'generated',
          deliveryStatus: 'pending',
          retryCount: 0,
        });
      } else {
        certRecord.pdfPath = pdfPath;
        certRecord.templateId = templateId;
        certRecord.deliveryStatus = 'pending';
        certRecord.status = 'generated';
        await certRecord.save();
      }

      // Send Email
      let emailStatus = 'pending';
      if (sendEmail && user.email) {
        try {
          await sendCertificateEmail({
            to: user.email,
            participantName: user.fullName || `${user.firstName} ${user.lastName}`,
            eventName: event.title,
            pdfPath,
          });

          emailStatus = 'sent';
          certRecord.emailSent = true;
          certRecord.emailSentAt = now;
          certRecord.status = 'sent';
          certRecord.deliveryStatus = 'sent';
        } catch (emailErr) {
          emailStatus = 'failed';
          certRecord.deliveryStatus = 'failed';
          certRecord.failureReason = emailErr.message;
          certRecord.retryCount += 1;
          certRecord.lastAttemptAt = now;
        }
        await certRecord.save();
      }

      results.push({
        userId: user._id,
        participantName: user.fullName,
        status: emailStatus === 'sent' ? 'success' : 'failed',
        deliveryStatus: emailStatus
      });

    } catch (err) {
      console.error(`Certificate Error for ${user._id}:`, err);
      results.push({ userId: user._id, status: 'failed', reason: err.message });
    }
  }

  // Update Event Stats
  await Event.findByIdAndUpdate(eventId, {
    certificatesSent: true,
    certificatesSentAt: new Date(),
  });

  return {
    success: true,
    total: attendances.length,
    results,
  };
}

// ─────────────────────────────────────────────────────────────────
// PREVIEW
// ─────────────────────────────────────────────────────────────────
async function previewCertificate({ eventId, userId, templateId, customFields = {}, dummy = false }) {
  let event, user;

  if (dummy) {
    // Dummy Data
    event = {
      title: 'AI Innovation Summit 2026',
      eventDate: new Date(),
      venue: 'Main Auditorium',
      organiserName: 'Tech Committee',
      department: 'Computer Science',
      chiefGuest: 'Dr. A.P.J. Abdul Kalam (Tribute)',
      ...customFields // Allow overriding dummy fields
    };
    user = {
      fullName: 'John Doe',
      firstName: 'John',
      lastName: 'Doe',
      department: 'B.Tech CSE',
      ...customFields
    };
  } else {
    // Real DB Data
    [event, user] = await Promise.all([
      Event.findById(eventId).lean(),
      User.findById(userId).lean(),
    ]);

    if (!event) throw new Error('Event not found');
    if (!user) throw new Error('User not found');

    // Check attendance if strict
    // ... logic ...
  }

  // Merge templateId into customFields so it's picked up
  if (templateId) customFields.templateId = templateId;

  const { html, certificateId } = await generateCertificateHTML(
    eventId || 'dummy_event', // Pass ID or dummy string
    user,
    event,
    customFields
  );

  return { html, certificateId };
}

// ─────────────────────────────────────────────────────────────────
// RESEND SINGLE
// ─────────────────────────────────────────────────────────────────
async function resendSingleCertificate(eventId, userId) {
  const cert = await Certificate.findOne({ event: eventId, user: userId });
  if (!cert) throw new Error('Certificate not found. Please generate first.');

  const user = await User.findById(userId).lean();
  const event = await Event.findById(eventId).lean();
  if (!user || !event) throw new Error('User or Event missing');

  try {
    // Regenerate PDF if missing? (Optional, assume exists or regen)
    let pdfPath = cert.pdfPath;
    if (!fs.existsSync(pdfPath)) {
      // Regenerate logic here if needed
      const { html } = await generateCertificateHTML(eventId, user, event, cert.customFields, cert.certificateId);
      const outputDir = path.dirname(pdfPath);
      if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
      pdfPath = path.join(outputDir, `${cert.certificateId}.pdf`);
      await htmlToPdf(html, pdfPath);
    }

    await sendCertificateEmail({
      to: user.email,
      participantName: user.fullName,
      eventName: event.title,
      pdfPath,
    });

    cert.deliveryStatus = 'sent';
    cert.emailSent = true;
    cert.emailSentAt = new Date();
    cert.status = 'sent';
    await cert.save();

    return { success: true };
  } catch (err) {
    cert.deliveryStatus = 'failed';
    cert.failureReason = err.message;
    cert.retryCount += 1;
    cert.lastAttemptAt = new Date();
    await cert.save();
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────
// RESEND FAILED
// ─────────────────────────────────────────────────────────────────
async function resendFailedCertificates(eventId) {
  const failedCerts = await Certificate.find({
    event: eventId,
    deliveryStatus: 'failed',
    retryCount: { $lt: 3 } // Max retries
  }).populate('user');

  const results = [];
  const event = await Event.findById(eventId).lean();

  for (const cert of failedCerts) {
    try {
      await sendCertificateEmail({
        to: cert.user.email,
        participantName: cert.user.fullName,
        eventName: event.title,
        pdfPath: cert.pdfPath,
      });

      cert.deliveryStatus = 'sent';
      cert.emailSent = true;
      cert.emailSentAt = new Date();
      cert.status = 'sent';
      await cert.save();
      results.push({ userId: cert.user._id, status: 'success' });
    } catch (err) {
      cert.retryCount += 1;
      cert.lastAttemptAt = new Date();
      cert.failureReason = err.message;
      await cert.save();
      results.push({ userId: cert.user._id, status: 'failed', reason: err.message });
    }
  }

  return {
    total: failedCerts.length,
    success: results.filter(r => r.status === 'success').length,
    results
  };
}

// Export
module.exports = {
  getEffectiveSettings,
  generateCertificateHTML,
  generateCertificatesForEvent,
  previewCertificate,
  resendSingleCertificate,
  resendFailedCertificates,
  saveCertificateRecord: async (data) => Certificate.create(data), // Wrapper if needed
};