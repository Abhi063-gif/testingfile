const Event = require("../models/event");
const Attendance = require("../models/attendance");
const GalleryImage = require("../models/galleryImage");
const UserHistory = require("../models/userHistory");
const catchAsync = require("../utils/catchAsync.js");

exports.getUserAnalytics = catchAsync(async (req, res, next) => {
    const userId = req.user._id;

    // 1. Events Hosted: Count events created by user
    const eventsHosted = await Event.countDocuments({ createdBy: userId });

    // 2. Events Attended: Count attendance records for user
    // Assuming 'present' is the status for attended events. Adjust if needed.
    const eventsAttended = await Attendance.countDocuments({
        user: userId,
        status: "present"
    });

    // 3. Total Uploads: Count gallery images uploaded by user
    const totalUploads = await GalleryImage.countDocuments({ uploader: userId });

    // 4. Total Downloads: Count 'downloaded_image' actions in UserHistory
    // We look for the specific action string "downloaded_image"
    const totalDownloads = await UserHistory.countDocuments({
        user: userId,
        action: "downloaded_image"
    });

    // 5. Recent Activity: Fetch last 10 actions
    // We want to format this to match the frontend 'RecentActivityModel' expectation
    // Frontend expects: id, title, subtitle, timestamp, type
    const recentHistory = await UserHistory.find({ user: userId })
        .sort({ createdAt: -1 })
        .limit(10)
        .populate("relatedEvent", "title")
        .populate("relatedUser", "firstName lastName");

    const recentActivities = recentHistory.map((history) => {
        let title = "";
        let subtitle = "";
        let type = "eventJoined"; // Default fallback

        switch (history.action) {
            case "joined_event":
                title = "Joined Event";
                subtitle = history.relatedEvent ? history.relatedEvent.title : "Unknown Event";
                type = "eventJoined";
                break;
            case "created_event":
                title = "Created Event";
                subtitle = history.relatedEvent ? history.relatedEvent.title : "New Event";
                type = "eventHosted";
                break;
            case "uploaded_image":
                title = "Uploaded Image";
                subtitle = history.relatedEvent ? `to ${history.relatedEvent.title}` : "to Gallery";
                type = "imageUploaded";
                break;
            case "downloaded_image":
                title = "Downloaded Image";
                subtitle = history.relatedEvent ? `from ${history.relatedEvent.title}` : "from Gallery";
                type = "imageDownloaded";
                break;
            case "marked_attendance": // Assuming this action exists or will be logged
                title = "Marked Attendance";
                subtitle = history.relatedEvent ? history.relatedEvent.title : "Event";
                type = "attendanceMarked";
                break;
            default:
                // Generic fallback for other actions
                title = history.action.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
                subtitle = history.description || "";
                type = "eventJoined"; // Reusing an icon for now, or add 'other' type in frontend
        }

        return {
            id: history._id,
            title,
            subtitle,
            timestamp: history.createdAt,
            type,
        };
    });

    res.status(200).json({
        status: "success",
        data: {
            eventsHosted,
            eventsAttended,
            totalUploads,
            totalDownloads,
            recentActivities,
        },
    });
});

// Get full user history (paginated)
exports.getAllActivities = catchAsync(async (req, res, next) => {
    const userId = req.user._id;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    const activities = await UserHistory.find({ user: userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("relatedEvent", "title");

    const total = await UserHistory.countDocuments({ user: userId });

    // Reuse the mapping logic if possible or send raw data and let frontend handle it
    // For consistency, let's map it similarly
    const formattedActivities = activities.map((history) => {
        let title = "";
        let subtitle = "";
        let type = "eventJoined"; // Default fallback

        switch (history.action) {
            case "joined_event":
                title = "Joined Event";
                subtitle = history.relatedEvent ? history.relatedEvent.title : "Unknown Event";
                type = "eventJoined";
                break;
            case "created_event":
                title = "Created Event";
                subtitle = history.relatedEvent ? history.relatedEvent.title : "New Event";
                type = "eventHosted";
                break;
            case "uploaded_image":
                title = "Uploaded Image";
                subtitle = history.relatedEvent ? `to ${history.relatedEvent.title}` : "to Gallery";
                type = "imageUploaded";
                break;
            case "downloaded_image":
                title = "Downloaded Image";
                subtitle = history.relatedEvent ? `from ${history.relatedEvent.title}` : "from Gallery";
                type = "imageDownloaded";
                break;
            case "marked_attendance":
                title = "Marked Attendance";
                subtitle = history.relatedEvent ? history.relatedEvent.title : "Event";
                type = "attendanceMarked";
                break;
            default:
                title = history.action.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
                subtitle = history.description || "";
                type = "eventJoined";
        }

        return {
            id: history._id,
            title,
            subtitle,
            timestamp: history.createdAt,
            type,
        };
    });

    res.status(200).json({
        status: "success",
        results: activities.length,
        total,
        page,
        data: { activities: formattedActivities }
    });
});
