
// /cron/certificateCron.js
const cron = require('node-cron');
const { generateCertificatesForEvent } = require('../services/certificateService');
const { Event } = require('../models');

const startCertificateCron = () => {
  // Run certificate generation cron every hour at minute 0
  // Cron expression: '0 * * * *' = every hour
  cron.schedule('0 * * * *', async () => {
    try {
      console.log('[CertificateCron] Starting certificate generation job at', new Date().toISOString());

      // Query for events that:
      // 1. Have ended (eventDate is in the past)
      // 2. Have autoSendAfterEventEnd enabled
      // 3. Certificates haven't been sent yet
      const now = new Date();
      const eventsToProcess = await Event.find({
        eventDate: { $lt: now },
        autoSendAfterEventEnd: true,
        certificatesSent: false,
      }).lean();

      if (eventsToProcess.length === 0) {
        console.log('[CertificateCron] No events pending certificate generation');
        return;
      }

      console.log(`[CertificateCron] Found ${eventsToProcess.length} event(s) to process`);

      // Process each event
      for (const event of eventsToProcess) {
        try {
          console.log(`[CertificateCron] Processing event: ${event._id} - ${event.title}`);

          // Generate and send certificates for this event
          const result = await generateCertificatesForEvent(event._id.toString(), {
            sendEmail: true,
            savePdf: true,
            forceRegenerate: false,
          });

          console.log(`[CertificateCron] Event ${event._id} completed:`, {
            success: result.success,
            total: result.total,
            successCount: result.results ? result.results.filter(r => r.status === 'success').length : 0,
          });

        } catch (eventError) {
          console.error(`[CertificateCron] Error processing event ${event._id}:`, eventError.message);
        }
      }

      console.log('[CertificateCron] Certificate generation job completed at', new Date().toISOString());

    } catch (error) {
      console.error('[CertificateCron] Fatal error in certificate generation cron:', error.message);
    }
  });

  console.log('[CertificateCron] Certificate generation cron job started (runs hourly)');
};

module.exports = startCertificateCron;
