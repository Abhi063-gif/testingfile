const cloudinary = require('../config/cloudinary');
const streamifier = require('streamifier');

/**
 * Upload a buffer (from Multer memory storage) to Cloudinary.
 * Detects resource type (image/video) automatically based on file extension.
 * @param {Buffer} buffer - file buffer from Multer
 * @param {String} originalName - original filename (used to infer type)
 * @param {String} folder - Cloudinary folder (e.g., 'event-posters')
 * @returns {Promise<Object>} - { secure_url, public_id, resource_type }
 */
function uploadToCloudinary(buffer, originalName, folder) {
  return new Promise((resolve, reject) => {
    const isVideo = /\.(mp4|webm|mov|avi|mkv)$/i.test(originalName);
    const resource_type = isVideo ? 'video' : 'image';

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type,
        public_id: `${folder}/${Date.now()}_${originalName.replace(/\.[^.]+$/, '')}`,
        overwrite: false,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve({ secure_url: result.secure_url, public_id: result.public_id, resource_type: result.resource_type });
      }
    );

    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
}

/** Delete a Cloudinary asset by its public_id */
function deleteFromCloudinary(publicId) {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.destroy(publicId, { resource_type: 'auto' }, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
}

module.exports = {
  uploadToCloudinary,
  uploadFile: uploadToCloudinary, // alias for backward compatibility
  deleteFromCloudinary,
};
