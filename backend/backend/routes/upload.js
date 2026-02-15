const router = require("express").Router();
const uploadController = require("../controllers/upload");
const authController = require("../controllers/auth");

// Protect upload route
router.use(authController.protect);

router.post("/poster", uploadController.uploadPosterMiddleware, uploadController.uploadPoster);

module.exports = router;
