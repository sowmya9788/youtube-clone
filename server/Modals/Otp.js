import mongoose from "mongoose";

const otpSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    otpHash: {
      type: String,
      required: true,
    },
    tempToken: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    deviceInfo: {
      deviceId: { type: String, required: true },
      deviceName: { type: String },
      browser: { type: String },
      os: { type: String },
      userAgent: { type: String },
    },
    locationInfo: {
      city: { type: String, default: "Unknown City" },
      state: { type: String, default: "Unknown State" },
      country: { type: String, default: "India" },
      ip: { type: String },
    },
    loginPayload: {
      name: { type: String },
      image: { type: String },
    },
    attempts: {
      type: Number,
      default: 0,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    resendAvailableAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// TTL index to automatically clean up expired OTP records after 15 minutes
otpSchema.index({ createdAt: 1 }, { expireAfterSeconds: 900 });

export default mongoose.model("otp", otpSchema);
