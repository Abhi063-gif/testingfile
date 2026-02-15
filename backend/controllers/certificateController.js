
// /controllers/certificateController.js
// RESTful handlers for certificate generation module

const path = require('path');
const fs = require('fs');
const archiver = require('archiver');
const moment = require('moment');

const {
  getEffectiveSettings,
  generateCertificateHTML,
  generateCertificatesForEvent,
  previewCertificate,
  resendSingleCertificate,
  resendFailedCertificates,
} = require('../services/certificateService');

const CertificateSettings = require('../models/certificateSettings');
const { Certificate, Event, User } = require('../models');

// ─────────────────────────────────────────────────────────────────
// SETTINGS: Get / Update
// ─────────────────────────────────────────────────────────────────
exports.getSettings = async (req, res) => {
  try {
    const { eventId } = req.params;
    const settings = await CertificateSettings.findOne({ event: eventId });
    // If no settings exist yet, return defaults structure for frontend to populate
    const effective = await getEffectiveSettings(eventId);

    return res.json({
      success: true,
      data: settings || {},
      effective, // Return merged effective config so UI knows what will be used
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const { eventId } = req.params;
    const updates = req.body;

    const settings = await CertificateSettings.findOneAndUpdate(
      { event: eventId },
      { ...updates, event: eventId },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return res.json({ success: true, data: settings });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────
// PREVIEW
// ─────────────────────────────────────────────────────────────────
exports.previewCertificate = async (req, res) => {
  try {
    const { eventId, userId, templateId, dummy, ...customFields } = req.query;

    if (!dummy && (!eventId || !userId)) {
      return res.status(400).json({ success: false, message: 'eventId and userId required (unless dummy=true)' });
    }

    const { html, certificateId } = await previewCertificate({
      eventId,
      userId,
      templateId: parseInt(templateId),
      customFields,
      dummy: dummy === 'true',
    });

    if (req.query.format === 'html') {
      return res.type('html').send(html);
    }

    return res.json({ success: true, html, certificateId });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────
// BULK GENERATE
// ─────────────────────────────────────────────────────────────────
exports.generateBulk = async (req, res) => {
  try {
    const { eventId, forceRegenerate = false, sendEmail = true } = req.body;

    if (!eventId) {
      return res.status(400).json({ success: false, message: 'eventId is required' });
    }

    // Trigger generation (this can be long running, maybe better to return 202 Accepted)
    // For now we await it as per request
    const result = await generateCertificatesForEvent(eventId, {
      sendEmail,
      savePdf: true,
      forceRegenerate
    });

    return res.json(result);
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────
// RESEND OPERATIONS
// ─────────────────────────────────────────────────────────────────
exports.resendFailed = async (req, res) => {
  try {
    const { eventId } = req.params;
    const result = await resendFailedCertificates(eventId);
    return res.json({ success: true, ...result });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.resendSingle = async (req, res) => {
  try {
    const { eventId, userId } = req.body;
    await resendSingleCertificate(eventId, userId);
    return res.json({ success: true, message: 'Resent successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────
// LIST / STATS
// ─────────────────────────────────────────────────────────────────
exports.listEventCertificates = async (req, res) => {
  try {
    const { eventId } = req.params;

    // Stats calculation
    const [total, sent, failed, pending] = await Promise.all([
      Certificate.countDocuments({ event: eventId }),
      Certificate.countDocuments({ event: eventId, status: 'sent' }),
      Certificate.countDocuments({ event: eventId, deliveryStatus: 'failed' }),
      Certificate.countDocuments({ event: eventId, deliveryStatus: 'pending' }),
    ]);

    const certs = await Certificate.find({ event: eventId })
      .populate('user', 'firstName lastName email department')
      .sort({ updatedAt: -1 })
      .limit(100); // Limit for performance

    return res.json({
      success: true,
      stats: { total, sent, failed, pending, successRate: total ? (sent / total) * 100 : 0 },
      data: certs,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────
// EXISTING HELPERS (Preserved)
// ─────────────────────────────────────────────────────────────────
exports.listTemplates = async (req, res) => {
  const templates = [
    { id: 1, name: 'Classic Formal', description: 'Traditional academic style' },
    { id: 2, name: 'Modern Minimal', description: 'Sleek dark design' },
    { id: 3, name: 'Royal Blue', description: 'Clean white body with blue header' },
    { id: 4, name: 'Emerald Tech', description: 'Green split panel' },
    { id: 5, name: 'Vintage Parchment', description: 'Old-world heritage style' },
    { id: 6, name: 'Vibrant Purple', description: 'Contemporary gradient' },
    { id: 7, name: 'Sunrise Orange', description: 'Energetic warm design' },
  ];
  return res.json({ success: true, data: templates });
};

exports.verifyCertificate = async (req, res) => {
  try {
    const { certificateId } = req.params;
    const cert = await Certificate
      .findOne({ certificateId })
      .populate('event', 'title eventDate venue organiserName')
      .populate('user', 'firstName lastName department')
      .lean();

    if (!cert) {
      return res.status(404).json({ success: false, valid: false, message: 'Certificate not found' });
    }

    return res.json({
      success: true,
      valid: true,
      data: {
        certificateId: cert.certificateId,
        participantName: `${cert.user.firstName} ${cert.user.lastName}`,
        department: cert.user.department,
        eventTitle: cert.event.title,
        eventDate: moment(cert.event.eventDate).format('DD MMMM YYYY'),
        venue: cert.event.venue,
        issuedAt: moment(cert.issuedAt).format('DD MMMM YYYY'),
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};