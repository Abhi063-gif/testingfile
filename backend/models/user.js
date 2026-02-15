const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const crypto = require("crypto");

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, "First Name is required"],
  },
  lastName: {
    type: String,
    default: "",
  },
  about: {
    type: String,
  },
  department: {
    type: String,
  },
  avatar: {
    type: String,
  },
  // Store Cloudinary image info for profile picture
  profileImage: {
    url: { type: String },
    public_id: { type: String },
  },
  email: {
    type: String,
    required: [true, "Email is required"],
    unique: true,
    validate: {
      validator: function (email) {
        return String(email)
          .toLowerCase()
          .match(
            /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
          );
      },
      message: (props) => `Email (${props.value}) is invalid!`,
    },
  },
  password: {
    type: String,
    select: false,
  },
  passwordChangedAt: {
    type: Date,
    select: false,
  },
  passwordResetToken: {
    type: String,
    select: false,
  },
  passwordResetExpires: {
    type: Date,
    select: false,
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  verified: {
    type: Boolean,
    default: false,
  },
  otp: {
    type: String,
    select: false,
  },
  otp_expiry_time: {
    type: Date,
    select: false,
  },

  socket_id: {
    type: String,
  },
  status: {
    type: String,
    enum: ["Online", "Offline"],
  },
}, {
  timestamps: true,
});

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return [this.firstName, this.lastName].filter(Boolean).join(' ');
});

// Pre-save hook to hash OTP
userSchema.pre("save", async function (next) {
  if (!this.isModified("otp") || !this.otp) return next();
  this.otp = await bcrypt.hash(this.otp.toString(), 12);
  next();
});

// Pre-save hook to hash password
userSchema.pre("save", async function (next) {
  if (!this.isModified("password") || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Pre-save hook to update passwordChangedAt
userSchema.pre("save", function (next) {
  if (!this.isModified("password") || this.isNew || !this.password)
    return next();
  this.passwordChangedAt = Date.now() - 1000;
  next();
});

// Pre-save hook to sync verified and isVerified
userSchema.pre("save", function (next) {
  if (this.isModified("verified")) {
    this.isVerified = this.verified;
  }
  if (this.isModified("isVerified")) {
    this.verified = this.isVerified;
  }
  next();
});

userSchema.methods.correctPassword = async function (
  candidatePassword,
  userPassword
) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

userSchema.methods.correctOTP = async function (candidateOTP, userOTP) {
  return await bcrypt.compare(candidateOTP, userOTP);
};

userSchema.methods.changedPasswordAfter = function (JWTTimeStamp) {
  if (this.passwordChangedAt) {
    const changedTimeStamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10
    );
    return JWTTimeStamp < changedTimeStamp;
  }
  return false;
};

userSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString("hex");

  this.passwordResetToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;

  return resetToken;
};

// Ensure virtuals are included in JSON
userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

const User = mongoose.models.User || mongoose.model("User", userSchema);
module.exports = User;