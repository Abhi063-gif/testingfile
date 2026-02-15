// Export all models from a single index file to prevent duplicate model registration
module.exports = {
  Certificate: require('./certificate'),
  Event: require('./event'),
  User: require('./user'),
  Attendance: require('./attendance'),
  CertificateSettings: require('./certificateSettings'),
  GalleryImage: require('./galleryImage'),
  Notification: require('./notification'),
  UserHistory: require('./userHistory'),
};
