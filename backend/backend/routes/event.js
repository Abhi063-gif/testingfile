const router = require("express").Router();
const eventController = require("../controllers/event");
const authController = require("../controllers/auth");
const { upload } = require("../middleware/multer.middleware");

// All routes require authentication
router.use(authController.protect);

// Event CRUD
router.get("/", eventController.getAllEvents);
// Support poster upload (field name: poster) via Multer memory storage
router.post("/", upload.single("poster"), eventController.createEvent);
router.get("/my-events", eventController.getMyEvents);
router.get("/public", eventController.getPublicEvents);
router.get("/code/:code", eventController.getEventByCode);
router.get("/settings/:id", eventController.getEventSettings); // ✅ Added settings route
router.put("/settings/:id", eventController.updateEventSettings); // ✅ Added settings update route
router.get("/:id/editors", eventController.getEventEditors); // ✅ Added editors route
router.get("/:id", eventController.getEvent);
router.put("/:id", eventController.updateEvent);
router.delete("/:id", eventController.deleteEvent);

// Sub-admin management
router.post("/:id/sub-admins", eventController.addSubAdmin);
router.delete("/:id/sub-admins/:userId", eventController.removeSubAdmin);

// Participation
router.post("/:id/join", eventController.joinEvent);
router.post("/:id/leave", eventController.leaveEvent);

// ✅ Attendance Routes (Mounted directly here for URL /events/:id/attendance/mark compatibility)
const attendanceController = require("../controllers/attendance");
router.post("/:eventId/attendance/mark", attendanceController.markAttendance);
router.get("/:eventId/attendance", attendanceController.getEventAttendance);

module.exports = router;
