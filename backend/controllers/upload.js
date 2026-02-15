const { upload } = require("../middleware/multer.middleware");
const { uploadFile } = require("../services/cloudinaryUpload");

// Middleware for uploading a single poster (memory storage)
exports.uploadPosterMiddleware = upload.single("poster");

// Controller: upload poster to Cloudinary and return its URL
exports.uploadPoster = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ status: "error", message: "No file uploaded" });
    }

    // Upload buffer to Cloudinary under the appropriate folder
    const result = await uploadFile(req.file.buffer, req.file.originalname, "event-posters");

    res.status(200).json({
      status: "success",
      message: "Poster uploaded successfully",
      data: { url: result.secure_url, public_id: result.public_id },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "error", message: "Cloudinary upload failed", error: err.message });
  }
};
