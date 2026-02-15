const mongoose = require("mongoose");

const galleryImageSchema = new mongoose.Schema({
    event: {
        type: mongoose.Schema.ObjectId,
        ref: "Event",
        required: [true, "Image must belong to an event"],
    },
    uploader: {
        type: mongoose.Schema.ObjectId,
        ref: "User",
        required: [true, "Image must have an uploader"],
    },
    imageUrl: {
        type: String,
        required: [true, "Image URL is required"],
    },
    thumbnailUrl: {
        type: String,
    },
    // Store Cloudinary public_id for future delete/replace operations
    public_id: {
        type: String,
    },
    tags: [String],
    likes: [{
        type: mongoose.Schema.ObjectId,
        ref: "User"
    }]
}, {
    timestamps: true
});

// Virtual for id
galleryImageSchema.virtual('id').get(function () {
    return this._id.toHexString();
});

galleryImageSchema.set('toJSON', {
    virtuals: true,
    transform: function (doc, ret) {
        delete ret._id;
        delete ret.__v;
    }
});

module.exports = mongoose.models.GalleryImage || mongoose.model("GalleryImage", galleryImageSchema);
