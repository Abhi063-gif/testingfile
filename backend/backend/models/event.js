const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, "Event title is required"],
        trim: true,
        maxlength: [100, "Title cannot exceed 100 characters"],
    },
    description: {
        type: String,
        trim: true,
        maxlength: [2000, "Description cannot exceed 2000 characters"],
    },
    venue: {
        type: String,
        required: [true, "Venue is required"],
        trim: true,
    },
    department: {
        type: String,
        trim: true,
    },
    organiserName: {
        type: String,
        required: [true, "Organiser name is required"],
        trim: true,
    },
    // Cloudinary poster image info
    poster: {
        url: { type: String },
        public_id: { type: String },
    },
    eventDate: {
        type: Date,
        required: [true, "Event date is required"],
    },
    expiryDate: {
        type: Date,
    },
    hostEmailForAttendance: {
        type: String,
        trim: true,
        validate: {
            validator: function (v) {
                return /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(v);
            },
            message: "Please enter a valid email"
        }
    },
    privacy: {
        type: String,
        enum: ["public", "private"],
        default: "public",
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    eventCode: {
        type: String,
        unique: true,
        sparse: true,
    },
    attendeeUploadEnabled: {
        type: Boolean,
        default: false,
    },

    // EVENT OWNERSHIP & PERMISSIONS
    createdBy: {
        type: mongoose.Schema.ObjectId,
        ref: "User",
        required: [true, "Event must have a creator"],
    },
    subAdmins: {
        type: [{
            type: mongoose.Schema.ObjectId,
            ref: "User",
        }],
        validate: {
            validator: function (arr) {
                return arr.length <= 3;
            },
            message: "Maximum 3 sub-admins allowed per event",
        },
        default: [],
    },
    participants: [{
        type: mongoose.Schema.ObjectId,
        ref: "User",
    }],

    // STATS FIELDS
    totalUploads: {
        type: Number,
        default: 0,
    },
    totalDownloads: {
        type: Number,
        default: 0,
    },
    // CERTIFICATE AUTO-SEND CONFIG
    autoSendAfterEventEnd: {
        type: Boolean,
        default: false,
    },
    certificatesSent: {
        type: Boolean,
        default: false,
    },
    certificatesSentAt: {
        type: Date,
    },
}, {
    timestamps: true,
});

// Virtual field for backward compatibility – many front‑ends still expect `posterUrl`
eventSchema.virtual('posterUrl').get(function () {
    return this.poster ? this.poster.url : undefined;
});

// Ensure virtuals are included when converting to JSON / Object
eventSchema.set('toJSON', { virtuals: true });
eventSchema.set('toObject', { virtuals: true });

// Indexes for faster queries
eventSchema.index({ createdBy: 1 });
eventSchema.index({ eventDate: 1 });
eventSchema.index({ privacy: 1, isActive: 1 });

// Generate unique event code before saving
eventSchema.pre("save", async function (next) {
    if (!this.eventCode) {
        const generateCode = () => {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            let code = '';
            for (let i = 0; i < 6; i++) {
                code += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return code;
        };

        let code = generateCode();
        let exists = await mongoose.model('Event').findOne({ eventCode: code });
        while (exists) {
            code = generateCode();
            exists = await mongoose.model('Event').findOne({ eventCode: code });
        }
        this.eventCode = code;
    }
    next();
});

// Helper to get ID string safely
const getId = (obj) => {
    if (!obj) return null;
    return obj._id ? obj._id.toString() : obj.toString();
};

// Instance method to check if user is main admin
eventSchema.methods.isMainAdmin = function (userId) {
    const creatorId = getId(this.createdBy);
    return creatorId && creatorId === userId.toString();
};

// Instance method to check if user is sub-admin
eventSchema.methods.isSubAdmin = function (userId) {
    if (!this.subAdmins) return false;
    return this.subAdmins.some(admin => getId(admin) === userId.toString());
};

// Instance method to check if user is participant
eventSchema.methods.isParticipant = function (userId) {
    if (!this.participants) return false;
    return this.participants.some(participant => getId(participant) === userId.toString());
};

// Instance method to get user permission level
eventSchema.methods.getUserPermission = function (userId) {
    if (this.isMainAdmin(userId)) return 'main_admin';
    if (this.isSubAdmin(userId)) return 'sub_admin';
    if (this.isParticipant(userId)) return 'participant';
    return 'none';
};

// Instance method to check if user can edit event
eventSchema.methods.canEdit = function (userId) {
    return this.isMainAdmin(userId) || this.isSubAdmin(userId);
};

// Instance method to check if user can delete event
eventSchema.methods.canDelete = function (userId) {
    return this.isMainAdmin(userId);
};

// Instance method to check if user can add sub-admin
eventSchema.methods.canAddSubAdmin = function (userId) {
    return this.isMainAdmin(userId) && this.subAdmins.length < 3;
};

// Instance method to add sub-admin
eventSchema.methods.addSubAdmin = function (userId) {
    if (this.subAdmins.length >= 3) {
        throw new Error("Maximum 3 sub-admins allowed");
    }
    if (this.isSubAdmin(userId)) {
        throw new Error("User is already a sub-admin");
    }
    if (this.isMainAdmin(userId)) {
        throw new Error("Main admin cannot be added as sub-admin");
    }
    this.subAdmins.push(userId);
    return this;
};

// Instance method to remove sub-admin
eventSchema.methods.removeSubAdmin = function (userId) {
    const index = this.subAdmins.findIndex(id => id.toString() === userId.toString());
    if (index === -1) {
        throw new Error("User is not a sub-admin");
    }
    this.subAdmins.splice(index, 1);
    return this;
};

// Instance method to add participant
eventSchema.methods.addParticipant = function (userId) {
    if (this.isParticipant(userId)) {
        throw new Error("User is already a participant");
    }
    this.participants.push(userId);
    return this;
};

// Instance method to remove participant
eventSchema.methods.removeParticipant = function (userId) {
    const index = this.participants.findIndex(id => id.toString() === userId.toString());
    if (index === -1) {
        throw new Error("User is not a participant");
    }
    this.participants.splice(index, 1);
    return this;
};

const Event = mongoose.models.Event || mongoose.model("Event", eventSchema);
module.exports = Event;
