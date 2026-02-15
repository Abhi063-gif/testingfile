// Use memory‑based Multer middleware (defined in backend/middleware/multer.middleware.js)
const { upload } = require("../middleware/multer.middleware");
const { uploadToCloudinary } = require("../services/cloudinaryUpload");
const Event = require("../models/event");
const GalleryImage = require("../models/galleryImage");

// Middleware – expose Multer handlers for bulk and single uploads
exports.uploadBulkMiddleware = upload.array("images", 20); // Max 20 images
exports.uploadSingleMiddleware = upload.single("image");

/** Helper: upload a file buffer to Cloudinary under event-gallery folder */
async function uploadBufferToCloudinary(buffer, originalName) {
  const result = await uploadToCloudinary(buffer, originalName, "event-gallery");
  return result; // { secure_url, public_id, resource_type }
}

// Bulk Upload Controller – now uploads to Cloudinary
exports.bulkUpload = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ status: "error", message: "No files uploaded" });
    }

    const eventId = req.body.eventId || req.body.event_id;
    if (!eventId) {
      return res.status(400).json({ status: "error", message: "Event ID is required" });
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ status: "error", message: "Event not found" });
    }

    // Permission Check
    const userId = req.user._id;
    if (!event.canEdit(userId) && !event.attendeeUploadEnabled) {
      return res.status(403).json({
        status: "error",
        message: "Uploading pic not allowed"
      });
    }

    const savedImages = [];
    for (const file of req.files) {
      const uploadResult = await uploadBufferToCloudinary(file.buffer, file.originalname);
      const image = await GalleryImage.create({
        event: eventId,
        uploader: userId,
        imageUrl: uploadResult.secure_url,
        thumbnailUrl: uploadResult.secure_url,
        // optional: store public_id for later deletion
        public_id: uploadResult.public_id,
      });
      savedImages.push(image);
    }

    await Event.findByIdAndUpdate(eventId, { $inc: { totalUploads: savedImages.length } });

    // Log User History for each upload? Or one bulk log?
    // Let's log one bulk action for simplicity/performance
    const UserHistory = require("../models/userHistory");
    await UserHistory.logAction({
      userId,
      action: "uploaded_image",
      eventId,
      description: `Uploaded ${savedImages.length} images`,
      metadata: { imageIds: savedImages.map(img => img._id) }
    });

    // Attach a convenient `url` field for frontend compatibility
    const imagesWithUrl = savedImages.map(img => ({
      ...img.toObject(),
      url: img.imageUrl,
    }));
    res.status(201).json({
      status: "success",
      message: `${savedImages.length} images uploaded successfully`,
      data: { images: imagesWithUrl },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "error", message: "Failed to upload images" });
  }
};

// Single Upload Controller – Cloudinary version
exports.uploadSingle = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ status: "error", message: "No file uploaded" });
    }
    const eventId = req.body.eventId || req.body.event_id;
    if (!eventId) {
      return res.status(400).json({ status: "error", message: "Event ID is required" });
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ status: "error", message: "Event not found" });
    }

    // Permission Check
    const userId = req.user._id;
    if (!event.canEdit(userId) && !event.attendeeUploadEnabled) {
      return res.status(403).json({
        status: "error",
        message: "Uploading pic not allowed"
      });
    }

    const uploadResult = await uploadBufferToCloudinary(req.file.buffer, req.file.originalname);
    const image = await GalleryImage.create({
      event: eventId,
      uploader: userId,
      imageUrl: uploadResult.secure_url,
      thumbnailUrl: uploadResult.secure_url,
      public_id: uploadResult.public_id,
    });

    await Event.findByIdAndUpdate(eventId, { $inc: { totalUploads: 1 } });

    // Log History
    const UserHistory = require("../models/userHistory");
    await UserHistory.logAction({
      userId,
      action: "uploaded_image",
      eventId,
      description: "Uploaded an image",
      metadata: { imageId: image._id }
    });

    const imageWithUrl = { ...image.toObject(), url: image.imageUrl };
    res.status(201).json({
      status: "success",
      message: "Image uploaded successfully",
      data: { image: imageWithUrl },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "error", message: "Failed to upload image" });
  }
};

// Track Download (New)
exports.trackDownload = async (req, res) => {
  try {
    const { eventId, imageId } = req.body;
    const userId = req.user._id;

    // Log History
    const UserHistory = require("../models/userHistory");
    await UserHistory.logAction({
      userId,
      action: "downloaded_image",
      eventId,
      description: "Downloaded an image",
      metadata: { imageId }
    });

    // Increment event download count if eventId is provided
    if (eventId) {
      await Event.findByIdAndUpdate(eventId, { $inc: { totalDownloads: 1 } });
    }

    res.status(200).json({
      status: "success",
      message: "Download tracked"
    });
  } catch (err) {
    console.error("Track download error:", err);
    // Don't fail the download if tracking fails, but log it
    res.status(500).json({ status: "error", message: "Failed to track download" });
  }
};

// Check Gallery Access – simple implementation based on event dates
// Returns "denied" while the event is active (now < eventDate), otherwise "granted"
exports.checkGalleryAccess = async (req, res) => {
  try {
    const { eventId } = req.params;
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ status: "error", message: "Event not found" });
    }

    const userId = req.user._id;
    // Admins/sub‑admins can always view the gallery – differentiate role
    if (event.canEdit(userId)) {
      const role = event.isMainAdmin(userId) ? "main_admin" : "sub_admin";
      return res.status(200).json({
        status: "success",
        data: { access: "granted", role, canUpload: true },
      });
    }

    const now = new Date();
    // If the event is still upcoming, deny access for regular users
    if (event.eventDate && now < event.eventDate) {
      return res.status(200).json({
        status: "success",
        data: {
          access: "denied",
          reason: "event_active",
          message: "Gallery will be available after the event ends.",
        },
      });
    }

    // Event has ended – grant view‑only access
    return res.status(200).json({
      status: "success",
      data: {
        access: "granted",
        role: "view_only",
        canUpload: event.attendeeUploadEnabled ?? false
      },
    });
  } catch (err) {
    console.error("Check gallery access error:", err);
    res.status(500).json({ status: "error", message: "Failed to check access" });
  }
};

// Toggle Favourite Controller
exports.toggleFavourite = async (req, res) => {
  try {
    const { imageId } = req.body;
    const userId = req.user._id;

    const image = await GalleryImage.findById(imageId);
    if (!image) {
      return res.status(404).json({
        status: "error",
        message: "Image not found",
      });
    }

    const index = image.likes.indexOf(userId);
    if (index === -1) {
      // Like
      image.likes.push(userId);
    } else {
      // Unlike
      image.likes.splice(index, 1);
    }

    await image.save();

    res.status(200).json({
      status: "success",
      success: true,
      data: {
        isFavourite: index === -1 // true if newly liked
      }
    });
  } catch (err) {
    console.error("Toggle favourite error:", err);
    res.status(500).json({
      status: "error",
      message: "Failed to toggle favourite",
    });
  }
};

// Get Event Images Controller – returns formatted list for frontend
exports.getEventImages = async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user._id;

    const images = await GalleryImage.find({ event: eventId })
      .populate('uploader', 'fullName avatar')
      .sort({ createdAt: -1 });

    const formatted = images.map(img => ({
      id: img._id,
      eventId: img.event,
      imageUrl: img.imageUrl,
      thumbnailUrl: img.thumbnailUrl,
      uploadedAt: img.createdAt,
      uploadedBy: img.uploader ? img.uploader.fullName : 'Unknown',
      isFavourite: img.likes.includes(userId),
      isDownloaded: false,
      tags: img.tags,
    }));

    res.status(200).json({
      status: 'success',
      data: { images: formatted },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: 'Failed to fetch images' });
  }
};

// Get My Downloaded Images
exports.getMyDownloadedImages = async (req, res) => {
  try {
    const userId = req.user._id;

    // 1. Find download actions in UserHistory for this user
    const downloadHistory = await UserHistory.find({
      user: userId,
      action: "downloaded_image"
    });

    if (!downloadHistory.length) {
      return res.status(200).json({ status: 'success', data: { images: [] } });
    }

    // 2. Extract unique image IDs
    const imageIds = [...new Set(downloadHistory.map(h => h.metadata.imageId))];

    // 3. Fetch these images
    const images = await GalleryImage.find({ _id: { $in: imageIds } })
      .populate('uploader', 'fullName avatar')
      .populate('event', 'title') // To show event name optionally
      .sort({ createdAt: -1 });

    const formatted = images.map(img => ({
      id: img._id,
      eventId: img.event?._id || img.event,
      eventName: img.event?.title || 'Unknown Event',
      imageUrl: img.imageUrl,
      thumbnailUrl: img.thumbnailUrl,
      uploadedAt: img.createdAt,
      uploadedBy: img.uploader ? img.uploader.fullName : 'Unknown',
      isFavourite: img.likes.includes(userId),
      isDownloaded: true,
      tags: img.tags,
    }));

    res.status(200).json({
      status: 'success',
      data: { images: formatted },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: 'Failed to fetch downloaded images' });
  }
};

// Get My Uploaded Images
exports.getMyUploadedImages = async (req, res) => {
  try {
    const userId = req.user._id;

    const images = await GalleryImage.find({ uploader: userId })
      .populate('event', 'title')
      .sort({ createdAt: -1 });

    const formatted = images.map(img => ({
      id: img._id,
      eventId: img.event?._id || img.event,
      eventName: img.event?.title || 'Unknown Event',
      imageUrl: img.imageUrl,
      thumbnailUrl: img.thumbnailUrl,
      uploadedAt: img.createdAt,
      uploadedBy: 'You',
      isFavourite: img.likes.includes(userId),
      isDownloaded: false, // Or check if also downloaded
      tags: img.tags,
    }));

    res.status(200).json({
      status: 'success',
      data: { images: formatted },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: 'Failed to fetch uploaded images' });
  }
};
