import "dotenv/config";
import mongoose from "mongoose";
import crypto from "crypto";
import users from "../Modals/Auth.js";
import Otp from "../Modals/Otp.js";
import {
  calculateISTTheme,
  parseUserAgent,
  getLocationFromIp,
  sendSecurityOtpEmail,
} from "../filehelper/geoAndDevice.js";

/* ==================================================================
   1. POST /user/login
   - Handles login & registration
   - Detects Device & City/State
   - Evaluates Theme based on IST (10 AM - 12 PM light, else dark)
   - Triggers OTP verification if new device/location detected
================================================================== */
export const login = async (req, res) => {
  const { email, name, image, deviceId } = req.body;
  const userAgent = req.body.userAgent || req.headers["user-agent"] || "";

  try {
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // Resolve client IP and device details
    const rawIp =
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.socket?.remoteAddress ||
      req.ip ||
      "";

    const parsedDevice = parseUserAgent(userAgent);
    const deviceInfo = {
      deviceId: deviceId || "web_device_default",
      deviceName: parsedDevice.deviceName,
      browser: parsedDevice.browser,
      os: parsedDevice.os,
      userAgent,
      verifiedAt: new Date(),
    };

    const locationInfo = await getLocationFromIp(rawIp);

    const existingUser = await users.findOne({ email });

    /* ---------------------------------------------------------------
       Case A: First-time Registration (New User)
    --------------------------------------------------------------- */
    if (!existingUser) {
      const initialTheme = calculateISTTheme();

      const newUser = await users.create({
        email,
        name,
        image,
        theme: initialTheme,
        themePreference: "auto",
        devices: [deviceInfo],
        locations: [
          {
            city: locationInfo.city,
            state: locationInfo.state,
            country: locationInfo.country,
            lastIp: locationInfo.ip,
            verifiedAt: new Date(),
          },
        ],
        loginHistory: [
          {
            deviceId: deviceInfo.deviceId,
            deviceName: deviceInfo.deviceName,
            city: locationInfo.city,
            state: locationInfo.state,
            ip: locationInfo.ip,
            loginAt: new Date(),
            status: "registered",
          },
        ],
      });

      return res.status(201).json({
        result: newUser,
        otpRequired: false,
      });
    }

    /* ---------------------------------------------------------------
       Case B: Existing User
       - Migrate legacy plans if any
       - Check if current device & location are already verified
    --------------------------------------------------------------- */
    const validPlans = ["free", "bronze", "silver", "gold"];
    if (!validPlans.includes(existingUser.plan)) {
      existingUser.plan = "free";
    }

    // Check device match
    const isDeviceKnown =
      existingUser.devices &&
      existingUser.devices.length > 0 &&
      existingUser.devices.some(
        (d) => d.deviceId === deviceInfo.deviceId
      );

    // Check city and state match
    const isLocationKnown =
      existingUser.locations &&
      existingUser.locations.length > 0 &&
      existingUser.locations.some(
        (loc) =>
          loc.city.toLowerCase() === locationInfo.city.toLowerCase() &&
          loc.state.toLowerCase() === locationInfo.state.toLowerCase()
      );

    // If user has no previous device/location recorded at all (pre-security update),
    // we can either require OTP or treat as first verification.
    const isFirstRecordedLogin =
      (!existingUser.devices || existingUser.devices.length === 0) &&
      (!existingUser.locations || existingUser.locations.length === 0);

    /* ---------------------------------------------------------------
       B.1: Known Device AND Known Location (or initial seed) -> Direct Login
    --------------------------------------------------------------- */
    if (isFirstRecordedLogin || (isDeviceKnown && isLocationKnown)) {
      // If first recorded login, seed current device & location
      if (isFirstRecordedLogin) {
        existingUser.devices = [deviceInfo];
        existingUser.locations = [
          {
            city: locationInfo.city,
            state: locationInfo.state,
            country: locationInfo.country,
            lastIp: locationInfo.ip,
            verifiedAt: new Date(),
          },
        ];
      }

      // Update theme based on IST if user hasn't chosen manual preference
      if (existingUser.themePreference !== "manual") {
        existingUser.theme = calculateISTTheme();
      }

      // Record successful login in history
      existingUser.loginHistory.unshift({
        deviceId: deviceInfo.deviceId,
        deviceName: deviceInfo.deviceName,
        city: locationInfo.city,
        state: locationInfo.state,
        ip: locationInfo.ip,
        loginAt: new Date(),
        status: "success",
      });

      // Keep login history bounded to latest 50
      if (existingUser.loginHistory.length > 50) {
        existingUser.loginHistory = existingUser.loginHistory.slice(0, 50);
      }

      await existingUser.save();

      return res.status(200).json({
        result: existingUser,
        otpRequired: false,
      });
    }

    /* ---------------------------------------------------------------
       B.2: New Device OR New Location Detected -> Require OTP
    --------------------------------------------------------------- */
    // Generate secure 6-digit OTP
    const otpCode = crypto.randomInt(100000, 999999).toString();
    const otpHash = crypto.createHash("sha256").update(otpCode).digest("hex");
    const tempToken = crypto.randomBytes(24).toString("hex");

    // Clean any prior pending OTP for this email
    await Otp.deleteMany({ email });

    // Store OTP session (10 minutes expiration)
    await Otp.create({
      userId: existingUser._id,
      email,
      otpHash,
      tempToken,
      deviceInfo,
      locationInfo,
      loginPayload: { name, image },
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      resendAvailableAt: new Date(Date.now() + 60 * 1000),
    });

    // Send email with OTP and security details
    await sendSecurityOtpEmail({
      toEmail: email,
      userName: existingUser.name,
      otpCode,
      deviceInfo,
      locationInfo,
    });

    return res.status(200).json({
      otpRequired: true,
      tempToken,
      email: existingUser.email,
      device: {
        deviceName: deviceInfo.deviceName,
        browser: deviceInfo.browser,
        os: deviceInfo.os,
      },
      location: {
        city: locationInfo.city,
        state: locationInfo.state,
        country: locationInfo.country,
      },
      message:
        "New device or location detected. An OTP has been sent to your registered email.",
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

/* ==================================================================
   2. POST /user/verify-otp
   - Verifies OTP, registers the new device/location, completes login
================================================================== */
export const verifyLoginOtp = async (req, res) => {
  const { tempToken, otp } = req.body;

  try {
    if (!tempToken || !otp) {
      return res.status(400).json({ message: "Token and OTP are required" });
    }

    const otpRecord = await Otp.findOne({ tempToken });

    if (!otpRecord) {
      return res
        .status(404)
        .json({ message: "Verification session not found or expired. Please sign in again." });
    }

    // Check expiration
    if (new Date() > otpRecord.expiresAt) {
      await Otp.findByIdAndDelete(otpRecord._id);
      return res.status(400).json({ message: "OTP has expired. Please request a new code." });
    }

    // Check maximum attempts limit
    if (otpRecord.attempts >= 5) {
      await Otp.findByIdAndDelete(otpRecord._id);
      return res.status(429).json({
        message: "Maximum OTP attempts exceeded. Please start login again.",
      });
    }

    // Verify OTP hash
    const inputHash = crypto
      .createHash("sha256")
      .update(otp.toString().trim())
      .digest("hex");

    if (inputHash !== otpRecord.otpHash) {
      otpRecord.attempts += 1;
      await otpRecord.save();
      const remaining = 5 - otpRecord.attempts;
      return res.status(400).json({
        message: `Incorrect OTP code. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`,
      });
    }

    // OTP Verified! Fetch User
    const user = await users.findById(otpRecord.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Add device if not already present
    const deviceExists = user.devices.some(
      (d) => d.deviceId === otpRecord.deviceInfo.deviceId
    );
    if (!deviceExists) {
      user.devices.push({
        ...otpRecord.deviceInfo,
        verifiedAt: new Date(),
      });
    }

    // Add location if not already present
    const locationExists = user.locations.some(
      (loc) =>
        loc.city.toLowerCase() === otpRecord.locationInfo.city.toLowerCase() &&
        loc.state.toLowerCase() === otpRecord.locationInfo.state.toLowerCase()
    );
    if (!locationExists) {
      user.locations.push({
        city: otpRecord.locationInfo.city,
        state: otpRecord.locationInfo.state,
        country: otpRecord.locationInfo.country,
        lastIp: otpRecord.locationInfo.ip,
        verifiedAt: new Date(),
      });
    }

    // Update theme based on IST if user preference is auto
    if (user.themePreference !== "manual") {
      user.theme = calculateISTTheme();
    }

    // Record login in history
    user.loginHistory.unshift({
      deviceId: otpRecord.deviceInfo.deviceId,
      deviceName: otpRecord.deviceInfo.deviceName,
      city: otpRecord.locationInfo.city,
      state: otpRecord.locationInfo.state,
      ip: otpRecord.locationInfo.ip,
      loginAt: new Date(),
      status: "otp_verified",
    });

    if (user.loginHistory.length > 50) {
      user.loginHistory = user.loginHistory.slice(0, 50);
    }

    await user.save();

    // Consume OTP (single use)
    await Otp.findByIdAndDelete(otpRecord._id);

    return res.status(200).json({
      success: true,
      result: user,
      message: "Device and location verified successfully!",
    });
  } catch (error) {
    console.error("verifyLoginOtp error:", error);
    return res.status(500).json({ message: "Failed to verify OTP" });
  }
};

/* ==================================================================
   3. POST /user/resend-otp
   - Resends OTP with rate-limiting cooldown
================================================================== */
export const resendLoginOtp = async (req, res) => {
  const { tempToken } = req.body;

  try {
    if (!tempToken) {
      return res.status(400).json({ message: "Token is required" });
    }

    const otpRecord = await Otp.findOne({ tempToken });
    if (!otpRecord) {
      return res.status(404).json({ message: "Verification session not found" });
    }

    // Check cooldown
    if (new Date() < otpRecord.resendAvailableAt) {
      const waitSeconds = Math.ceil(
        (otpRecord.resendAvailableAt.getTime() - Date.now()) / 1000
      );
      return res.status(429).json({
        message: `Please wait ${waitSeconds}s before requesting another code.`,
      });
    }

    // Generate new OTP
    const otpCode = crypto.randomInt(100000, 999999).toString();
    const otpHash = crypto.createHash("sha256").update(otpCode).digest("hex");

    otpRecord.otpHash = otpHash;
    otpRecord.attempts = 0;
    otpRecord.expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    otpRecord.resendAvailableAt = new Date(Date.now() + 60 * 1000);
    await otpRecord.save();

    await sendSecurityOtpEmail({
      toEmail: otpRecord.email,
      userName: otpRecord.loginPayload?.name || otpRecord.email,
      otpCode,
      deviceInfo: otpRecord.deviceInfo,
      locationInfo: otpRecord.locationInfo,
    });

    return res.status(200).json({
      success: true,
      message: "New verification code sent to your email.",
    });
  } catch (error) {
    console.error("resendLoginOtp error:", error);
    return res.status(500).json({ message: "Failed to resend OTP" });
  }
};

/* ==================================================================
   4. PATCH /user/theme/:id
   - Updates user's manual or auto theme selection
================================================================== */
export const updateTheme = async (req, res) => {
  const { id: _id } = req.params;
  const { theme, themePreference = "manual" } = req.body;

  if (!mongoose.Types.ObjectId.isValid(_id)) {
    return res.status(400).json({ message: "Invalid user ID" });
  }

  if (!["light", "dark"].includes(theme)) {
    return res.status(400).json({ message: "Theme must be 'light' or 'dark'" });
  }

  try {
    const updatedUser = await users.findByIdAndUpdate(
      _id,
      {
        $set: {
          theme,
          themePreference,
        },
      },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
      success: true,
      theme: updatedUser.theme,
      themePreference: updatedUser.themePreference,
      result: updatedUser,
    });
  } catch (error) {
    console.error("updateTheme error:", error);
    return res.status(500).json({ message: "Failed to update theme" });
  }
};

/* ==================================================================
   5. PATCH /user/update/:id
   - Existing profile update functionality preserved
================================================================== */
export const updateprofile = async (req, res) => {
  const { id: _id } = req.params;
  const { channelname, description } = req.body;
  if (!mongoose.Types.ObjectId.isValid(_id)) {
    return res.status(500).json({ message: "User unavailable..." });
  }
  try {
    const updatedata = await users.findByIdAndUpdate(
      _id,
      {
        $set: {
          channelname: channelname,
          description: description,
        },
      },
      { new: true }
    );
    return res.status(201).json(updatedata);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

/* ==================================================================
   6. GET /user/channel/:id
   - Public channel details retrieval
================================================================== */
export const getChannelById = async (req, res) => {
  const { id } = req.params;

  try {
    if (mongoose.Types.ObjectId.isValid(id)) {
      const channelUser = await users
        .findById(id)
        .select("_id name channelname description image joinedon");
      if (channelUser) {
        return res.status(200).json(channelUser);
      }
    }

    // Try finding by channelname if not an ObjectId or not found by ID
    const channelByName = await users
      .findOne({
        $or: [{ channelname: id }, { name: id }],
      })
      .select("_id name channelname description image joinedon");

    if (channelByName) {
      return res.status(200).json(channelByName);
    }

    // Fallback response with placeholder details
    return res.status(200).json({
      _id: id,
      name: id,
      channelname: id,
      description: "",
      image: "",
    });
  } catch (error) {
    console.error("getChannelById error:", error);
    return res.status(500).json({ message: "Failed to fetch channel details" });
  }
};

