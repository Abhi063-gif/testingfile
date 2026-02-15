const router = require("express").Router();
const attendanceController = require("../controllers/attendance");
const authController = require("../controllers/auth");

// All routes require authentication
router.use(authController.protect);

// Routes for Attendance
// POST /attendance/mark/:eventId (Assuming this endpoint structure or match app config)
// The AppConfig might be pointing to /events/:eventId/attendance/mark -> Let's check ApiEndpoints.dart again.
// ApiEndpoints.markEventAttendance(eventId) => '/events/$eventId/attendance/mark';
// So these routes might need to be mounted under /events router OR we adjust the structure.
// If we mount this router at /attendance, then the path handles general attendance actions.
// But if the frontend calls /events/:id/..., we should probably put it in event routes or mount this router there.

// Let's create general routes here first.

router.post("/mark", attendanceController.markAttendance); // OLD/Generic way
// But wait, the Frontend uses: ApiEndpoints.markEventAttendance(eventId) => '/events/$eventId/attendance/mark';
// This implies this logic should likely be attached to the EVENT router, or the frontend needs to be compatible.

// However, I can also expose:
// GET /attendance/list?eventId=...
router.get("/list", attendanceController.getEventAttendance);

// POST /attendance/generate-qr -> Handled by link service or here? Link service generates the URL. 
// This backend might generate the QR data content payload if specific.

// POST /attendance/generate-qr
router.post("/generate-qr", attendanceController.generateQR);

module.exports = router;
