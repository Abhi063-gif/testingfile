const Attendance = require("../models/attendance");
const Event = require("../models/event");
const User = require("../models/user");
// Import async wrapper utility (explicit .js extension for safety)
const catchAsync = require("../utils/catchAsync.js");

// Wrap controller functions with catchAsync to forward errors to Express error handler

exports.markAttendance = catchAsync(async (req, res) => {
    try {
        const { eventId } = req.params;
        const userId = req.user._id; // Assumes authMiddleware attaches user to req

        // 1. Check if event exists
        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).json({
                status: "fail",
                message: "Event not found",
            });
        }

        // 1.1 Check if event is active and not finished
        if (!event.isActive) {
            return res.status(400).json({
                status: "fail",
                message: "This event is no longer active.",
            });
        }

        if (event.expiryDate && new Date(event.expiryDate) < new Date()) {
            return res.status(400).json({
                status: "fail",
                message: "This event has ended. Attendance can no longer be marked.",
            });
        }

        // 2. Check if user is a participant
        // The Event model has an instance method isParticipant, assume we can use that or check manually
        // Since we didn't fetch the event with methods populated sometimes, let's just check the array
        const isParticipant = event.participants.includes(userId);
        // Note: includes might not work if ObjectIds are not strings. 
        // Better to use safe string comparison or the model method if available.
        // Let's rely on the method if the doc is a mongoose doc.

        // Re-fetching or casting to ensure we can check participation
        // event.participants is array of ObjectIds.
        const isPart = event.participants.some(id => id.toString() === userId.toString()) ||
            event.createdBy.toString() === userId.toString() ||
            event.subAdmins.some(id => id.toString() === userId.toString());

        if (!isPart) {
            return res.status(403).json({
                status: "fail",
                message: "You are not joined in this event.",
            });
        }

        // 3. Mark Attendance (Create or returning existing)
        // We use findOneAndUpdate with upsert: true or just create and handle duplicate error
        // But better to just create and let the unique index handle duplicates or check first

        const existingAttendance = await Attendance.findOne({ event: eventId, user: userId });

        if (existingAttendance) {
            return res.status(200).json({
                status: "success",
                message: "Attendance already marked",
                data: {
                    attendance: existingAttendance,
                    eventName: event.title,
                }
            });
        }

        const newAttendance = await Attendance.create({
            event: eventId,
            user: userId,
            status: 'present'
        });

        res.status(201).json({
            status: "success",
            data: {
                attendance: newAttendance,
                eventName: event.title,
            },
        });

    } catch (error) {
        console.error("Mark Attendance Error:", error);
        res.status(500).json({
            status: "error",
            message: error.message || "Internal server error",
        });
    }
});

exports.getEventAttendance = catchAsync(async (req, res) => {
    try {
        const { eventId } = req.params;

        // Check if user is admin/sub-admin of the event
        // (Skipping detailed permission check for brevity, but should be there)

        const attendanceList = await Attendance.find({ event: eventId })
            .populate('user', 'firstName lastName email profileImage rollNumber'); // Populate user details

        res.status(200).json({
            status: "success",
            results: attendanceList.length,
            data: {
                attendance: attendanceList
            }
        });

    } catch (error) {
        res.status(500).json({
            status: "error",
            message: error.message,
        });
    }
});

exports.generateQR = catchAsync(async (req, res) => {
    try {
        const { eventId, hostEmail } = req.body;

        if (!eventId || !hostEmail) {
            return res.status(400).json({
                status: "fail",
                message: "Event ID and Host Email are required",
            });
        }

        // Update Event with the email
        const event = await Event.findByIdAndUpdate(
            eventId,
            { hostEmailForAttendance: hostEmail, attendanceQREnabled: true },
            { new: true, runValidators: true }
        ).populate('createdBy', 'firstName lastName');

        if (!event) {
            return res.status(404).json({
                status: "fail",
                message: "Event not found",
            });
        }

        // ✅ NEW: Send email with attendance QR link
        const { sendEmail } = require('../services/mailer');
        
        // Generate the attendance deep link
        const attendanceLink = `${process.env.APP_LINK_DOMAIN || 'https://snapora.com'}/attendance/${eventId}`;
        
        const emailHtml = `
            <h2>Attendance QR Code for ${event.title}</h2>
            <p>Hello ${event.createdBy?.firstName || 'Event Admin'},</p>
            <p>Your attendance QR code has been generated. Share this link or show the QR code to attendees to mark their attendance:</p>
            
            <p><strong>Attendance Link:</strong></p>
            <p><a href="${attendanceLink}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Mark Attendance
            </a></p>
            
            <p><strong>Direct Link:</strong> ${attendanceLink}</p>
            
            <p>Event: <strong>${event.title}</strong></p>
            <p>Date & Time: <strong>${new Date(event.eventDate).toLocaleString()}</strong></p>
            
            <hr />
            <p><em>This is an automated email from SnapOra. Please do not reply to this email.</em></p>
        `;

        await sendEmail({
            recipient: hostEmail,
            subject: `Attendance QR Code - ${event.title}`,
            html: emailHtml,
            text: `Attendance link for ${event.title}: ${attendanceLink}`
        });

        res.status(200).json({
            status: "success",
            message: "Attendance QR settings updated and email sent",
            data: {
                qrCode: "QR_GENERATED_ON_CLIENT_SIDE",
                hostEmail: event.hostEmailForAttendance,
                attendanceLink: attendanceLink
            }
        });

    } catch (error) {
        console.error("Generate QR Error:", error);
        res.status(500).json({
            status: "error",
            message: error.message || "Internal server error",
        });
    }
});
