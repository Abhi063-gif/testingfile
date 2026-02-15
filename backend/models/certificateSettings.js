
// /models/certificateSettings.js
const mongoose = require('mongoose');

const certificateSettingsSchema = new mongoose.Schema({
    event: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Event',
        required: true,
        unique: true,
    },
    templateId: {
        type: Number,
        default: 1,
    },
    logoLeft: { type: String },
    logoRight: { type: String },
    signatures: [
        {
            name: String,
            title: String,
            imageUrl: String,
        }
    ],
    customFields: {
        type: Map,
        of: String,
        default: {},
    },
    autoSendAfterEventEnd: {
        type: Boolean,
        default: false,
    },
}, { timestamps: true });

const CertificateSettings = mongoose.models.CertificateSettings || mongoose.model('CertificateSettings', certificateSettingsSchema);
module.exports = CertificateSettings;
