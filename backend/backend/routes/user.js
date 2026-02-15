const router = require("express").Router();
const authController = require("../controllers/auth");
const userController = require("../controllers/user");
const { upload } = require("../middleware/multer.middleware");

// Allow profile image upload via multipart/form-data (field name: profileImage)
router.patch(
	"/update-me",
	authController.protect,
	upload.single("profileImage"),
	userController.updateMe
);

module.exports = router;