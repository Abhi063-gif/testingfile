const { default: mongoose } = require("mongoose");

const certificateSchema = new mongoose.Schema({
  certificateId: { type: String, unique: true, required: true },
  event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  templateId: { type: Number, default: 1, min: 1, max: 7 },
  issuedAt: { type: Date, default: Date.now },
  pdfPath: { type: String, default: '' },
  emailSent: { type: Boolean, default: false },
  emailSentAt: { type: Date },
  customFields: { type: Map, of: String, default: {} },
  status: {
    type: String,
    enum: ['generated', 'sent', 'failed'],
    default: 'generated'
  },
  deliveryStatus: {
    type: String,
    enum: ['pending', 'sent', 'failed'],
    default: 'pending'
  },
  failureReason: { type: String },
  retryCount: { type: Number, default: 0 },
  lastAttemptAt: { type: Date },
}, { timestamps: true });



const Certificate = mongoose.models.Certificate || mongoose.model('Certificate', certificateSchema);
module.exports = Certificate;