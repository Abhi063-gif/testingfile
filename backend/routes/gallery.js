const router = require("express").Router();
const galleryController = require("../controllers/gallery");
const authController = require("../controllers/auth");

// Protect all gallery routes
router.use(authController.protect);

// Upload routes
router.post("/upload/bulk", galleryController.uploadBulkMiddleware, galleryController.bulkUpload);
router.post("/upload/single", galleryController.uploadSingleMiddleware, galleryController.uploadSingle);

// Interaction routes
router.post("/toggle-favourite", galleryController.toggleFavourite);
router.post("/download/track", galleryController.trackDownload);

// Access check route
router.get("/access-status/:eventId", galleryController.checkGalleryAccess);

// Get images route
router.get("/my-downloads", galleryController.getMyDownloadedImages);
router.get("/my-uploads", galleryController.getMyUploadedImages);
router.get("/images/:eventId", galleryController.getEventImages);

module.exports = router;
