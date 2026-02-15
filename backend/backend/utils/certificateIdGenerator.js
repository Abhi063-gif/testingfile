// /utils/certificateIdGenerator.js
// Generates unique, human-readable certificate IDs like: IIC-20240212-10-488

const { v4: uuidv4 } = require('uuid');

/**
 * Generate a certificate ID matching the format: PREFIX-YYYYMMDD-SEQ-RANDOM
 * Example: CERT-20240212-01-4882
 */
function generateCertificateId(eventDate, sequenceNumber = null, prefix = 'CERT') {
  const date = eventDate ? new Date(eventDate) : new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;

  const seq = sequenceNumber !== null
    ? String(sequenceNumber).padStart(2, '0')
    : String(Math.floor(Math.random() * 99) + 1).padStart(2, '0');

  const random = String(Math.floor(Math.random() * 9000) + 1000);

  return `${prefix}-${dateStr}-${seq}-${random}`;
}

/**
 * Ensure uniqueness by checking against DB
 */
async function generateUniqueCertificateId(eventDate, Certificate, seq = null) {
  let id;
  let attempts = 0;
  do {
    id = generateCertificateId(eventDate, seq, 'CERT');
    const exists = await Certificate.findOne({ certificateId: id });
    if (!exists) break;
    attempts++;
  } while (attempts < 10);
  return id;
}

module.exports = { generateCertificateId, generateUniqueCertificateId };