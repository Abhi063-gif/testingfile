const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.ObjectId,
        ref: "User",
        required: [true, "Notification must belong to a user"],
        index: true,
    },
    title: {
        type: String,
        required: [true, "Notification title is required"],
        trim: true,
        maxlength: [100, "Title cannot exceed 100 characters"],
    },
    message: {
        type: String,
        required: [true, "Notification message is required"],
        trim: true,
        maxlength: [500, "Message cannot exceed 500 characters"],
    },
    type: {
        type: String,
        enum: [
            "event_invite",
            "sub_admin_added",
            "sub_admin_removed",
            "event_update",
            "event_joined",
            "event_left",
            "new_upload",
            "new_download",
            "event_reminder",
            "system",
            "general",
        ],
        default: "general",
    },
    relatedEvent: {
        type: mongoose.Schema.ObjectId,
        ref: "Event",
    },
    relatedUser: {
        type: mongoose.Schema.ObjectId,
        ref: "User",
    },
    isRead: {
        type: Boolean,
        default: false,
    },
    readAt: {
        type: Date,
    },
    actionUrl: {
        type: String,
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
    },
}, {
    timestamps: true,
});

// Indexes for faster queries
notificationSchema.index({ user: 1, isRead: 1 });
notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ type: 1 });

// Instance method to mark as read
notificationSchema.methods.markAsRead = function () {
    this.isRead = true;
    this.readAt = new Date();
    return this.save();
};

// Static method to get unread count for user
notificationSchema.statics.getUnreadCount = function (userId) {
    return this.countDocuments({ user: userId, isRead: false });
};

// Static method to mark all as read for user
notificationSchema.statics.markAllAsRead = async function (userId) {
    return this.updateMany(
        { user: userId, isRead: false },
        { isRead: true, readAt: new Date() }
    );
};

// Static method to create event notification
notificationSchema.statics.createEventNotification = async function ({
    userId,
    eventId,
    type,
    title,
    message,
    actionUrl,
    metadata,
}) {
    return this.create({
        user: userId,
        relatedEvent: eventId,
        type,
        title,
        message,
        actionUrl,
        metadata,
    });
};

// Static method to notify all participants of an event
notificationSchema.statics.notifyEventParticipants = async function (event, {
    type,
    title,
    message,
    excludeUsers = [],
}) {
    const allUsers = [
        event.createdBy,
        ...event.subAdmins,
        ...event.participants,
    ].filter(userId => !excludeUsers.includes(userId.toString()));

    const uniqueUsers = [...new Set(allUsers.map(id => id.toString()))];

    const notifications = uniqueUsers.map(userId => ({
        user: userId,
        relatedEvent: event._id,
        type,
        title,
        message,
        actionUrl: `/events/${event._id}`,
    }));

    return this.insertMany(notifications);
};

const Notification = mongoose.models.Notification || mongoose.model("Notification", notificationSchema);
module.exports = Notification;
