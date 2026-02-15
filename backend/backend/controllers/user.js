const User = require("../models/user");
const filterObj = require("../utils/filterObj");
const { uploadFile, deleteFromCloudinary } = require("../services/cloudinaryUpload");

exports.updateMe = async (req, res, next) => {
    try {
        const { user } = req;
        if (req.body.name) req.body.fullName = req.body.name;

        const filteredBody = filterObj(req.body, "fullName", "about", "avatar", "phone");

        if (req.body.fullName) {
            const nameParts = req.body.fullName.split(" ");
            filteredBody.firstName = nameParts[0];
            filteredBody.lastName = nameParts.slice(1).join(" ");
        }

        // Handle profile image upload (Multer memory storage)
        if (req.file) {
            // Delete previous Cloudinary image if exists
            const existingUser = await User.findById(user._id).select("profileImage");
            if (existingUser && existingUser.profileImage && existingUser.profileImage.public_id) {
                await deleteFromCloudinary(existingUser.profileImage.public_id);
            }
            const uploadResult = await uploadFile(req.file.buffer, req.file.originalname, "user-profile");
            filteredBody.profileImage = {
                url: uploadResult.secure_url,
                public_id: uploadResult.public_id,
            };
        }

        const updated_user = await User.findByIdAndUpdate(user._id, filteredBody, {
            new: true,
            validateModifiedOnly: true,
        });

        if (!updated_user) {
            return res.status(404).json({ status: "error", message: "User not found" });
        }

        res.status(200).json({
            status: "success",
            message: "Updated successfully",
            data: updated_user,
        });
    } catch (err) {
        console.error(err);
        next(err);
    }
};





