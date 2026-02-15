
// /routes/certificateRoutes.js

const express = require('express');
const router = express.Router();
const certificateController = require('../controllers/certificateController');
// const { protect, restrictTo } = require('../middleware/authMiddleware'); // Uncomment if auth needed

// Public
router.get('/verify/:certificateId', certificateController.verifyCertificate);
router.get('/templates', certificateController.listTemplates);

// Admin / Private (Add auth middleware as needed, e.g. protect)
router.get('/settings/:eventId', certificateController.getSettings);
router.post('/settings/:eventId', certificateController.updateSettings);

router.get('/preview', certificateController.previewCertificate);
router.get('/list/:eventId', certificateController.listEventCertificates);

router.post('/generate-bulk', certificateController.generateBulk);
router.post('/resend-failed/:eventId', certificateController.resendFailed);
router.post('/resend-single', certificateController.resendSingle);

module.exports = router;