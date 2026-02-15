const jwt = require("jsonwebtoken");
const mailService = require("../services/mailer")
const otpGenerator = require("otp-generator");
const { promisify } = require("util");
const otp = require("../Template/mail/otp")
const crypto = require('crypto');
const resetPassword = require("../Template/mail/resetpassword");
const User = require("../models/user");
const filterObj = require("../utils/filterObj");
const signToken = (userId) => jwt.sign({ userId }, process.env.JWT_SECREATE);

exports.register = async (req, res, next) => {
  console.log("\n=== REGISTER START ===");
  console.log("[REGISTER] Client IP:", req.ip);
  console.log("[REGISTER] Content-Type:", req.headers['content-type']);
  console.log("[REGISTER] Received registration request");
  console.log("[REGISTER] Body:", req.body);
  
  const { email, password, phone } = req.body;
  const fullName = req.body.fullName || req.body.name;

  if (!fullName || !password || !email) {
    console.log("[REGISTER] Missing required fields");
    res.status(400).json({
      status: "error",
      message: "All fields are required",
    });
    return;
  }

  console.log("[REGISTER] All required fields present");
  const nameParts = fullName.split(" ");
  const firstName = nameParts[0];
  const lastName = nameParts.slice(1).join(" ");
  console.log("[REGISTER] Name split - firstName:", firstName, "lastName:", lastName);

  const filteredBody = filterObj(
    { ...req.body, firstName, lastName },
    "firstName",
    "lastName",
    "password",
    "email",
    "phone"
  );
  console.log("[REGISTER] Filtered body:", filteredBody);

  const existing_user = await User.findOne({ email });
  console.log("[REGISTER] Checking existing user for email:", email);
  console.log("[REGISTER] Existing user found:", existing_user ? "Yes" : "No");

  if (existing_user && existing_user.verified) {
    console.log("[REGISTER] User exists and already verified");
    res.status(400).json({
      status: "error",
      message: "Email is already in use, please login.",
    });
  } else if (existing_user) {
    console.log("[REGISTER] User exists but not verified - updating user");
    // Update user fields
    existing_user.firstName = filteredBody.firstName;
    existing_user.lastName = filteredBody.lastName;
    existing_user.password = filteredBody.password;
    existing_user.email = filteredBody.email;
    existing_user.phone = filteredBody.phone;
    // Use save() to trigger pre-save middleware (bcrypt hashing)
    const updated_user = await existing_user.save({ validateModifiedOnly: true });
    console.log("[REGISTER] User updated successfully with ID:", updated_user._id);
    req.userId = existing_user._id;
    next();
  } else {
    console.log("[REGISTER] Creating new user");
    const new_user = await User.create(filteredBody);
    console.log("[REGISTER] New user created with ID:", new_user._id);
    req.userId = new_user._id;
    next();
  }
  console.log("=== REGISTER END ===");
};

exports.sendOtp = async (req, res, next) => {
  console.log("\n=== SEND OTP START ===");
  console.log("[SEND OTP] UserId:", req.userId);
  
  const { userId } = req;
  console.log("[SEND OTP] Generating OTP...");
  const new_otp = otpGenerator.generate(6, {
    upperCaseAlphabets: false,
    specialChars: false,
    lowerCaseAlphabets: false,
  });
  console.log("[SEND OTP] OTP Generated:", new_otp);

  const otp_expiry_time = Date.now() + 10 * 60 * 1000; // 10 Mins after otp is sent
  console.log("[SEND OTP] OTP Expiry Time:", new Date(otp_expiry_time).toISOString());

  const user = await User.findByIdAndUpdate(userId, {
    otp_expiry_time: otp_expiry_time,
  });
  console.log("[SEND OTP] User found:", user.email);

  user.otp = new_otp.toString();
  console.log("[SEND OTP] OTP assigned to user object");

  await user.save({ new: true, validateModifiedOnly: true });
  console.log("[SEND OTP] User saved with OTP");

  console.log("[SEND OTP] Sending email to:", user.email);
  // TODO send mail
  await mailService.sendEmail({
    from: "shreyanshshah242@gmail.com",
    recipient: user.email,
    subject: "Verification OTP",
    html: otp(user.firstName, new_otp),
    attachments: [],
  });
  console.log("[SEND OTP] Email sent successfully");

  res.status(200).json({
    status: "success",
    message: "OTP Sent Successfully!",
  });
  console.log("=== SEND OTP END ===");
}
exports.verifyOTP = async (req, res, next) => {
  console.log("\n=== VERIFY OTP START ===");
  console.log("[VERIFY OTP] Request body:", req.body);
  
  // verify otp and update user accordingly
  const { email, otp } = req.body;
  console.log("[VERIFY OTP] Looking for user with email:", email);
  
  const user = await User.findOne({
    email,
    otp_expiry_time: { $gt: Date.now() },
  }).select("+otp");
  console.log("[VERIFY OTP] User found:", user ? "Yes" : "No");

  if (!user) {
    console.log("[VERIFY OTP] User not found or OTP expired");
    return res.status(400).json({
      status: "error",
      message: "Email is invalid or OTP expired",
    });
  }

  if (user.verified) {
    console.log("[VERIFY OTP] User already verified");
    return res.status(400).json({
      status: "error",
      message: "Email is already verified",
    });
  }

  console.log("[VERIFY OTP] Comparing OTP - Provided:", otp, "Stored:", user.otp);
  if (!(await user.correctOTP(otp, user.otp))) {
    console.log("[VERIFY OTP] OTP mismatch");
    res.status(400).json({
      status: "error",
      message: "OTP is incorrect",
    });
    return;
  }

  // OTP is correct
  console.log("[VERIFY OTP] OTP verified successfully");
  user.verified = true;
  user.otp = undefined;
  await user.save({ new: true, validateModifiedOnly: true });
  console.log("[VERIFY OTP] User marked as verified and saved");

  const token = signToken(user._id);
  console.log("[VERIFY OTP] Token generated");

  res.status(200).json({
    status: "success",
    message: "OTP verified Successfully!",
    data: {
      accessToken: token,
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
      }
    }
  });
  console.log("=== VERIFY OTP END ===");
}


exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        status: "error",
        message: "Both email and password are required",
      });
    }

    const user = await User.findOne({ email }).select("+password");

    if (!user || !(await user.correctPassword(password, user.password))) {
      return res.status(400).json({
        status: "error",
        message: "Email or password is incorrect",
      });
    }

    const token = signToken(user._id);

    res.status(200).json({
      status: "success",
      message: "Logged in successfully",
      data: {
        accessToken: token,
        user: {
          id: user._id,
          email: user.email,
          fullName: user.fullName,
        }
      }
    });
  } catch (err) {
    console.error("Error handling login: ", err);
    next(err);
  }
};

exports.protect = async (req, res, next) => {
  // 1) Getting token and check if it's there
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies && req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  if (!token) {
    return res.status(401).json({
      message: "You are not logged in! Please log in to get access.",
    });
  }
  // 2) Verification of token
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECREATE);

  console.log(decoded);

  // 3) Check if user still exists

  const this_user = await User.findById(decoded.userId);
  if (!this_user) {
    return res.status(401).json({
      message: "The user belonging to this token does no longer exists.",
    });
  }
  // 4) Check if user changed password after the token was issued
  if (this_user.changedPasswordAfter(decoded.iat)) {
    return res.status(401).json({
      message: "User recently changed password! Please log in again.",
    });
  }

  // GRANT ACCESS TO PROTECTED ROUTE
  req.user = this_user;
  next();
};

exports.forgotPassword = async (req, res, next) => {
  console.log("\n=== FORGOT PASSWORD START ===");
  console.log("[FORGOT PASSWORD] Request email:", req.body.email);
  
  // 1) Get user based on POSTed email
  const user = await User.findOne({ email: req.body.email });
  console.log("[FORGOT PASSWORD] User found:", user ? "Yes" : "No");
  
  if (!user) {
    console.log("[FORGOT PASSWORD] No user found with email:", req.body.email);
    return res.status(404).json({
      status: "error",
      message: "There is no user with email address.",
    });
  }

  // 2) Generate the random reset token
  console.log("[FORGOT PASSWORD] Generating password reset token...");
  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });
  console.log("[FORGOT PASSWORD] Reset token created and saved");

  // 3) Send it to user's email
  try {
    const resetURL = `http://localhost:3000/auth/new-password?token=${resetToken}`;
    console.log("[FORGOT PASSWORD] Reset URL:", resetURL);
    console.log("[FORGOT PASSWORD] Sending reset email to:", user.email);

    await mailService.sendEmail({
      recipient: user.email,
      subject: "Reset Password",
      html: resetPassword(user.firstName, resetURL),
      attachments: [],
    });
    console.log("[FORGOT PASSWORD] Reset email sent successfully");

    res.status(200).json({
      status: "success",
      message: "Token sent to email!",
    });
  } catch (err) {
    console.log("[FORGOT PASSWORD] Error sending email:", err.message);
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });
    console.log("[FORGOT PASSWORD] Reset token cleared due to error");

    return res.status(500).json({
      message: "There was an error sending the email. Try again later!",
    });
  }
  console.log("=== FORGOT PASSWORD END ===");
}
exports.resetPassword = async (req, res, next) => {
  console.log("\n=== RESET PASSWORD START ===");
  console.log("[RESET PASSWORD] Request token provided:", req.body.token ? "Yes" : "No");
  
  // 1) Get user based on the token
  const hashedToken = crypto
    .createHash("sha256")
    .update(req.body.token)
    .digest("hex");
  console.log("[RESET PASSWORD] Token hashed");

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });
  console.log("[RESET PASSWORD] User found with valid token:", user ? "Yes" : "No");

  // 2) If token has not expired, and there is user, set the new password
  if (!user) {
    console.log("[RESET PASSWORD] Token invalid or expired");
    return res.status(400).json({
      status: "error",
      message: "Token is Invalid or Expired",
    });
  }
  
  console.log("[RESET PASSWORD] Setting new password for user:", user.email);
  user.password = req.body.password;

  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();
  console.log("[RESET PASSWORD] Password updated and user saved");

  // 3) Update changedPasswordAt property for the user
  // 4) Log the user in, send JWT
  const token = signToken(user._id);
  console.log("[RESET PASSWORD] Token generated");

  res.status(200).json({
    status: "success",
    message: "Password Reseted Successfully",
    token,
  });
  console.log("=== RESET PASSWORD END ===");
};

// Get current authenticated user
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }

    res.status(200).json({
      status: "success",
      data: {
        user: {
          _id: user._id,
          fullName: user.fullName,
          email: user.email,
          department: user.department,
          about: user.about,
          avatar: user.avatar,
          profileImage: user.profileImage,
          isVerified: user.isVerified || user.verified,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      },
    });
  } catch (err) {
    console.error("Error getting user:", err);
    next(err);
  }
};

// Update profile
exports.updateProfile = async (req, res, next) => {
  try {
    const { fullName, department, about, profileImage, avatar } = req.body;

    const updateData = {};
    if (fullName) {
      const nameParts = fullName.split(" ");
      updateData.firstName = nameParts[0];
      updateData.lastName = nameParts.slice(1).join(" ");
    }
    if (department !== undefined) updateData.department = department;
    if (about !== undefined) updateData.about = about;
    if (profileImage !== undefined) updateData.profileImage = profileImage;
    if (avatar !== undefined) updateData.avatar = avatar;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }

    res.status(200).json({
      status: "success",
      message: "Profile updated successfully",
      data: {
        user: {
          _id: user._id,
          fullName: user.fullName,
          email: user.email,
          department: user.department,
          about: user.about,
          avatar: user.avatar,
          profileImage: user.profileImage,
          isVerified: user.isVerified || user.verified,
        },
      },
    });
  } catch (err) {
    console.error("Error updating profile:", err);
    next(err);
  }
};