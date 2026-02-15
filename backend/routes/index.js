const router = require("express").Router()

const authRoute = require("./auth")
const userRoute = require("./user")
const eventRoute = require("./event")
const uploadRoute = require("./upload")
const galleryRoute = require("./gallery")

router.use("/auth", authRoute)
router.use("/user", userRoute)
router.use("/events", eventRoute)
router.use("/upload", uploadRoute)
router.use("/gallery", galleryRoute)

// Attendance
const attendanceRoute = require("./attendance")
router.use("/attendance", attendanceRoute)

// Analytics
const analyticsRoute = require("./analytics")
router.use("/analytics", analyticsRoute)

// Link Service
const linkServiceRoute = require("./linkService")
router.use("/link", linkServiceRoute)

module.exports = router