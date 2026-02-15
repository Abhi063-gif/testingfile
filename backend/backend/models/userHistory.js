const mongoose = require("mongoose");

const userHistorySchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.ObjectId,
        ref: "User",
        required: [true, "History must belong to a user"],
        index: true,
    },
    action: {
        type: String,
        required: [true, "Action is required"],
        enum: [
            // Event actions
            "created_event",
            "updated_event",
            "deleted_event",
            "joined_event",
            "left_event",

            // Sub-admin actions
            "became_sub_admin",
            "removed_as_sub_admin",
            "added_sub_admin",
            "removed_sub_admin",

            // Gallery actions
            "uploaded_image",
            "downloaded_image",
            "deleted_image",

            // Profile actions
            "updated_profile",
            "changed_password",

            // Auth actions
            "logged_in",
            "logged_out",
            "verified_account",
            "reset_password",

            // Other
            "other",
        ],
    },
    relatedEvent: {
        type: mongoose.Schema.ObjectId,
        ref: "Event",
    },
    relatedUser: {
        type: mongoose.Schema.ObjectId,
        ref: "User",
    },
    description: {
        type: String,
        maxlength: [500, "Description cannot exceed 500 characters"],
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
    },
    ipAddress: {
        type: String,
    },
    userAgent: {
        type: String,
    },
}, {
    timestamps: true,
});

// Indexes for faster queries
userHistorySchema.index({ user: 1, createdAt: -1 });
userHistorySchema.index({ action: 1 });
userHistorySchema.index({ relatedEvent: 1 });

// Static method to log action
userHistorySchema.statics.logAction = async function ({
    userId,
    action,
    eventId,
    relatedUserId,
    description,
    metadata,
    ipAddress,
    userAgent,
}) {
    return this.create({
        user: userId,
        action,
        relatedEvent: eventId,
        relatedUser: relatedUserId,
        description,
        metadata,
        ipAddress,
        userAgent,
    });
};

// Static method to get user activity
userHistorySchema.statics.getUserActivity = function (userId, options = {}) {
    const { limit = 50, skip = 0, action } = options;

    const query = { user: userId };
    if (action) query.action = action;

    return this.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('relatedEvent', 'title')
        .populate('relatedUser', 'name firstName lastName');
};

// Static method to get event activity
userHistorySchema.statics.getEventActivity = function (eventId, options = {}) {
    const { limit = 50, skip = 0 } = options;

    return this.find({ relatedEvent: eventId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('user', 'name firstName lastName avatar');
};

const UserHistory = mongoose.models.UserHistory || mongoose.model("UserHistory", userHistorySchema);
module.exports = UserHistory;
