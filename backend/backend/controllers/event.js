const Event = require("../models/event");
const User = require("../models/user");
const Notification = require("../models/notification");
const UserHistory = require("../models/userHistory");
const filterObj = require("../utils/filterObj");

// Create a new event 
exports.createEvent = async (req, res, next) => {
    try {
        const {
            title,
            description,
            venue,
            department,
            organiserName: rawOrganiserName,
            // posterUrl may still be sent by older clients – we will map it to the new structure
            posterUrl,
            eventDate,
            expiryDate,
            privacy,
        } = req.body;

        const organiserName = rawOrganiserName || req.body.organizerName;

        if (!title || !venue || !organiserName || !eventDate) {
            return res.status(400).json({
                status: "error",
                message: "Title, venue, organiser name, and event date are required",
            });
        }

                // Determine poster object – prioritize uploaded file over posterUrl
                let poster;
                if (req.file) {
                    const { uploadFile } = require("../services/cloudinaryUpload");
                    const uploadResult = await uploadFile(req.file.buffer, req.file.originalname, "event-posters");
                    poster = { url: uploadResult.secure_url, public_id: uploadResult.public_id };
                } else if (posterUrl) {
                    poster = { url: posterUrl, public_id: "" };
                }

                const event = await Event.create({
                        title,
                        description,
                        venue,
                        department,
                        organiserName,
                        poster,
                        eventDate,
                        expiryDate,
                        privacy: privacy || "public",
                        createdBy: req.user._id,
                });

        // Log action
        await UserHistory.logAction({
            userId: req.user._id,
            action: "created_event",
            eventId: event._id,
            description: `Created event: ${title}`,
        });

        const eventObj = event.toObject();
        eventObj.permission = "main_admin";

        res.status(201).json({
            status: "success",
            message: "Event created successfully",
            data: {
                event: eventObj,
            },
        });
    } catch (err) {
        console.error("Error creating event:", err);
        next(err);
    }
};



// Get event settings
exports.getEventSettings = async (req, res, next) => {
    try {
        const event = await Event.findById(req.params.id);

        if (!event) {
            return res.status(404).json({
                status: "error",
                message: "Event not found",
            });
        }

        // Check permission (only host/editor)
        if (!event.canEdit(req.user._id)) {
            return res.status(403).json({
                status: "error",
                message: "You don't have permission to view settings",
            });
        }

        // Return default settings for now (or fetch from DB if you add settings schema later)
        res.status(200).json({
            status: "success",
            data: {
                // Default settings structure matching frontend expectation
                guestsCanUpload: true,
                guestsCanInvite: true,
                autoApprovePosts: false,
                showGuestList: true,
                allowComments: true,
                certificateGenerationEnabled: false,
                certificateTemplateId: null,
            },
        });
    } catch (err) {
        console.error("Error getting event settings:", err);
        next(err);
    }
};

// Get event editors (sub-admins)
exports.getEventEditors = async (req, res, next) => {
    try {
        const event = await Event.findById(req.params.id).populate('subAdmins', 'name email avatar');

        if (!event) {
            return res.status(404).json({
                status: "error",
                message: "Event not found",
            });
        }

        // Check permission (only host/editor)
        // Usually, even participants might see who are admins, but for "management" purpose likely restricted.
        // Assuming restricted for now as per "management" in URL name on frontend.
        if (!event.canEdit(req.user._id)) {
            return res.status(403).json({
                status: "error",
                message: "You don't have permission to view editors",
            });
        }

        res.status(200).json({
            status: "success",
            data: {
                editors: event.subAdmins
            }
        });
    } catch (err) {
        console.error("Error getting event editors:", err);
        next(err);
    }
};

// Update event settings
exports.updateEventSettings = async (req, res, next) => {
    try {
        const event = await Event.findById(req.params.id);

        if (!event) {
            return res.status(404).json({
                status: "error",
                message: "Event not found",
            });
        }

        // Check permission (only host/editor)
        if (!event.canEdit(req.user._id)) {
            return res.status(403).json({
                status: "error",
                message: "You don't have permission to update settings",
            });
        }

        // In a real implementation, you would update fields on the Event model or a separate Settings model.
        // For now, we'll just acknowledge the update.
        // const { bulkUploadEnabled, cameraUploadEnabled, ... } = req.body;

        res.status(200).json({
            status: "success",
            message: "Settings updated successfully",
            data: {
                settings: req.body
            }
        });
    } catch (err) {
        console.error("Error updating event settings:", err);
        next(err);
    }
};

// Get all events (My events + Public events)
exports.getAllEvents = async (req, res, next) => {
    try {
        const userId = req.user._id;

        // Find events where:
        // 1. User is creator/sub-admin/participant (My Events)
        // OR
        // 2. Event is public and active (Discovery)
        const events = await Event.find({
            $or: [
                { createdBy: userId },
                { subAdmins: userId },
                { participants: userId },
                { privacy: "public", isActive: true }
            ],
        })
            .populate("createdBy", "fullName avatar")
            // Show upcoming (future) events first by sorting descending (newest dates first)
            .sort({ eventDate: -1 });

        // Add permission info
        const eventsWithPermission = events.map((event) => ({
            ...event.toObject(),
            permission: event.getUserPermission(userId),
        }));

        res.status(200).json({
            status: "success",
            results: events.length,
            data: {
                events: eventsWithPermission,
            },
        });
    } catch (err) {
        console.error("Error getting all events:", err);
        next(err);
    }
};

// Get event details
exports.getEvent = async (req, res, next) => {
    try {
        const event = await Event.findById(req.params.id)
            .populate("createdBy", "fullName avatar profileImage")
            .populate("subAdmins", "fullName avatar profileImage")
            .populate("participants", "fullName avatar profileImage");

        if (!event) {
            return res.status(404).json({
                status: "error",
                message: "Event not found",
            });
        }

        // Get user permission for this event
        const permission = event.getUserPermission(req.user._id);

        const eventObj = event.toObject();
        eventObj.permission = permission;

        res.status(200).json({
            status: "success",
            data: {
                event: eventObj,
            },
        });
    } catch (err) {
        console.error("Error getting event:", err);
        next(err);
    }
};

// Get all events for current user
exports.getMyEvents = async (req, res, next) => {
    try {
        const userId = req.user._id;

        // Events where user is creator, sub-admin, or participant
        const events = await Event.find({
            $or: [
                { createdBy: userId },
                { subAdmins: userId },
                { participants: userId },
            ],
        })
            .populate("createdBy", "fullName avatar")
            .sort({ eventDate: -1 });

        // Add permission info to each event
        const eventsWithPermission = events.map((event) => ({
            ...event.toObject(),
            permission: event.getUserPermission(userId),
        }));

        res.status(200).json({
            status: "success",
            results: events.length,
            data: {
                events: eventsWithPermission,
            },
        });
    } catch (err) {
        console.error("Error getting my events:", err);
        next(err);
    }
};

// Get public events
exports.getPublicEvents = async (req, res, next) => {
    try {
        const events = await Event.find({
            privacy: "public",
            isActive: true,
            eventDate: { $gte: new Date() },
        })
            .populate("createdBy", "fullName avatar")
            .sort({ eventDate: 1 });

        res.status(200).json({
            status: "success",
            results: events.length,
            data: {
                events,
            },
        });
    } catch (err) {
        console.error("Error getting public events:", err);
        next(err);
    }
};

// Update event
exports.updateEvent = async (req, res, next) => {
    try {
        const event = await Event.findById(req.params.id);

        if (!event) {
            return res.status(404).json({
                status: "error",
                message: "Event not found",
            });
        }

        // Check permission (main admin or sub-admin can edit)
        if (!event.canEdit(req.user._id)) {
            return res.status(403).json({
                status: "error",
                message: "You don't have permission to edit this event",
            });
        }

        if (req.body.organizerName) req.body.organiserName = req.body.organizerName;

                // Build update object – handle poster upload if a new file is provided via Multer middleware
                const filteredBody = filterObj(
                        req.body,
                        "title",
                        "description",
                        "venue",
                        "department",
                        "organiserName",
                        "eventDate",
                        "expiryDate",
                        "privacy",
                        "isActive"
                );

                // If a new poster file is present (field name: poster), upload to Cloudinary
                if (req.file) {
                    // Delete old poster if exists
                    const existing = await Event.findById(req.params.id).select("poster");
                    if (existing && existing.poster && existing.poster.public_id) {
                        const { deleteFromCloudinary } = require("../services/cloudinaryUpload");
                        await deleteFromCloudinary(existing.poster.public_id);
                    }
                    const { uploadFile } = require("../services/cloudinaryUpload");
                    const uploadResult = await uploadFile(req.file.buffer, req.file.originalname, "event-posters");
                    filteredBody.poster = {
                        url: uploadResult.secure_url,
                        public_id: uploadResult.public_id,
                    };
                }

                const updatedEvent = await Event.findByIdAndUpdate(
                        req.params.id,
                        filteredBody,
                        { new: true, runValidators: true }
                );

        // Log action
        await UserHistory.logAction({
            userId: req.user._id,
            action: "updated_event",
            eventId: event._id,
            description: `Updated event: ${event.title}`,
        });

        res.status(200).json({
            status: "success",
            message: "Event updated successfully",
            data: {
                event: updatedEvent,
            },
        });
    } catch (err) {
        console.error("Error updating event:", err);
        next(err);
    }
};

// Delete event
exports.deleteEvent = async (req, res, next) => {
    try {
        const event = await Event.findById(req.params.id);

        if (!event) {
            return res.status(404).json({
                status: "error",
                message: "Event not found",
            });
        }

        // Only main admin can delete
        if (!event.canDelete(req.user._id)) {
            return res.status(403).json({
                status: "error",
                message: "Only the event creator can delete this event",
            });
        }

        await Event.findByIdAndDelete(req.params.id);

        // Log action
        await UserHistory.logAction({
            userId: req.user._id,
            action: "deleted_event",
            eventId: event._id,
            description: `Deleted event: ${event.title}`,
        });

        res.status(200).json({
            status: "success",
            message: "Event deleted successfully",
        });
    } catch (err) {
        console.error("Error deleting event:", err);
        next(err);
    }
};

// Add sub-admin
exports.addSubAdmin = async (req, res, next) => {
    try {
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({
                status: "error",
                message: "User ID is required",
            });
        }

        const event = await Event.findById(req.params.id);

        if (!event) {
            return res.status(404).json({
                status: "error",
                message: "Event not found",
            });
        }

        // Only main admin can add sub-admins
        if (!event.isMainAdmin(req.user._id)) {
            return res.status(403).json({
                status: "error",
                message: "Only the event creator can add sub-admins",
            });
        }

        // Check if user exists
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                status: "error",
                message: "User not found",
            });
        }

        try {
            event.addSubAdmin(userId);
            await event.save();
        } catch (err) {
            return res.status(400).json({
                status: "error",
                message: err.message,
            });
        }

        // Create notification for the new sub-admin
        await Notification.createEventNotification({
            userId,
            eventId: event._id,
            type: "sub_admin_added",
            title: "You're now a sub-admin",
            message: `You've been added as a sub-admin for "${event.title}"`,
            actionUrl: `/events/${event._id}`,
        });

        // Log action
        await UserHistory.logAction({
            userId: req.user._id,
            action: "added_sub_admin",
            eventId: event._id,
            relatedUserId: userId,
            description: `Added ${user.fullName} as sub-admin`,
        });

        await UserHistory.logAction({
            userId,
            action: "became_sub_admin",
            eventId: event._id,
            description: `Became sub-admin for: ${event.title}`,
        });

        res.status(200).json({
            status: "success",
            message: "Sub-admin added successfully",
            data: {
                event,
            },
        });
    } catch (err) {
        console.error("Error adding sub-admin:", err);
        next(err);
    }
};

// Remove sub-admin
exports.removeSubAdmin = async (req, res, next) => {
    try {
        const { userId } = req.params;

        const event = await Event.findById(req.params.id);

        if (!event) {
            return res.status(404).json({
                status: "error",
                message: "Event not found",
            });
        }

        // Only main admin can remove sub-admins
        if (!event.isMainAdmin(req.user._id)) {
            return res.status(403).json({
                status: "error",
                message: "Only the event creator can remove sub-admins",
            });
        }

        try {
            event.removeSubAdmin(userId);
            await event.save();
        } catch (err) {
            return res.status(400).json({
                status: "error",
                message: err.message,
            });
        }

        // Create notification
        await Notification.createEventNotification({
            userId,
            eventId: event._id,
            type: "sub_admin_removed",
            title: "Sub-admin status removed",
            message: `You've been removed as a sub-admin from "${event.title}"`,
        });

        // Log action
        await UserHistory.logAction({
            userId: req.user._id,
            action: "removed_sub_admin",
            eventId: event._id,
            relatedUserId: userId,
        });

        await UserHistory.logAction({
            userId,
            action: "removed_as_sub_admin",
            eventId: event._id,
        });

        res.status(200).json({
            status: "success",
            message: "Sub-admin removed successfully",
            data: {
                event,
            },
        });
    } catch (err) {
        console.error("Error removing sub-admin:", err);
        next(err);
    }
};

// Join event
exports.joinEvent = async (req, res, next) => {
    try {
        const event = await Event.findById(req.params.id);

        if (!event) {
            return res.status(404).json({
                status: "error",
                message: "Event not found",
            });
        }

        // Check if event is active
        if (!event.isActive) {
            return res.status(400).json({
                status: "error",
                message: "This event is no longer active",
            });
        }

        // Check if private event
        if (event.privacy === "private") {
            const { eventCode } = req.body;
            if (!eventCode || eventCode !== event.eventCode) {
                return res.status(403).json({
                    status: "error",
                    message: "Invalid event code for private event",
                });
            }
        }

        // Check if already a participant or admin
        const permission = event.getUserPermission(req.user._id);
        if (permission !== "none") {
            return res.status(400).json({
                status: "error",
                message: "You're already part of this event",
            });
        }

        event.addParticipant(req.user._id);
        await event.save();

        // Log action
        await UserHistory.logAction({
            userId: req.user._id,
            action: "joined_event",
            eventId: event._id,
            description: `Joined event: ${event.title}`,
        });

        // Notify event creator
        await Notification.createEventNotification({
            userId: event.createdBy,
            eventId: event._id,
            type: "event_joined",
            title: "New participant",
            message: `${req.user.fullName} joined "${event.title}"`,
        });

        res.status(200).json({
            status: "success",
            message: "Joined event successfully",
            data: {
                event,
                permission: "participant",
            },
        });
    } catch (err) {
        console.error("Error joining event:", err);
        next(err);
    }
};

// Leave event
exports.leaveEvent = async (req, res, next) => {
    try {
        const event = await Event.findById(req.params.id);

        if (!event) {
            return res.status(404).json({
                status: "error",
                message: "Event not found",
            });
        }

        // Main admin cannot leave their own event
        if (event.isMainAdmin(req.user._id)) {
            return res.status(400).json({
                status: "error",
                message: "Event creator cannot leave. Delete the event instead.",
            });
        }

        // Remove from sub-admins or participants
        if (event.isSubAdmin(req.user._id)) {
            event.removeSubAdmin(req.user._id);
        } else if (event.isParticipant(req.user._id)) {
            event.removeParticipant(req.user._id);
        } else {
            return res.status(400).json({
                status: "error",
                message: "You're not part of this event",
            });
        }

        await event.save();

        // Log action
        await UserHistory.logAction({
            userId: req.user._id,
            action: "left_event",
            eventId: event._id,
            description: `Left event: ${event.title}`,
        });

        res.status(200).json({
            status: "success",
            message: "Left event successfully",
        });
    } catch (err) {
        console.error("Error leaving event:", err);
        next(err);
    }
};

// Get event by code
exports.getEventByCode = async (req, res, next) => {
    try {
        const { code } = req.params;

        const event = await Event.findOne({ eventCode: code })
            .populate("createdBy", "fullName avatar");

        if (!event) {
            return res.status(404).json({
                status: "error",
                message: "Event not found",
            });
        }

        res.status(200).json({
            status: "success",
            data: {
                event: {
                    _id: event._id,
                    title: event.title,
                    description: event.description,
                    venue: event.venue,
                    eventDate: event.eventDate,
                    poster: event.poster,
                    organiserName: event.organiserName,
                    privacy: event.privacy,
                    createdBy: event.createdBy,
                },
            },
        });
    } catch (err) {
        console.error("Error getting event by code:", err);
        next(err);
    }
};
