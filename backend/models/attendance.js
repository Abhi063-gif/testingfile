const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema({
    event: {
        type: mongoose.Schema.ObjectId,
        ref: "Event",
        required: [true, "Attendance must belong to an event"],
    },
    user: {
        type: mongoose.Schema.ObjectId,
        ref: "User",
        required: [true, "Attendance must belong to a user"],
    },
    markedAt: {
        type: Date,
        default: Date.now,
    },
    // Optional: Location data if we want to add geofencing later
    location: {
        latitude: Number,
        longitude: Number,
    },
    status: {
        type: String,
        enum: ["present", "late", "excused"],
        default: "present",
    }
}, {
    timestamps: true,
});

// Prevent duplicate attendance for same user and event
attendanceSchema.index({ event: 1, user: 1 }, { unique: true });

const Attendance = mongoose.models.Attendance || mongoose.model("Attendance", attendanceSchema);
module.exports = Attendance;
