const router = require("express").Router()

const authController = require("../controllers/auth")


router.post("/login", authController.login)
router.post("/register", authController.register, authController.sendOtp)
router.post("/reset-password", authController.resetPassword)



router.post("/send-otp", authController.sendOtp)
router.post("/forgot-password", authController.forgotPassword)
router.post("/verify", authController.verifyOTP)

// Protected route - get current user
router.get("/me", authController.protect, authController.getMe)

module.exports = router