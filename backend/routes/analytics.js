const express = require("express");
const analyticsController = require("../controllers/analytics");
const authController = require("../controllers/auth");

const router = express.Router();

// Protect all routes
router.use(authController.protect);

router.get("/user", analyticsController.getUserAnalytics);
router.get("/history", analyticsController.getAllActivities);

module.exports = router;
