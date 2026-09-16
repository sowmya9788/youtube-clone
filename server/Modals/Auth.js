import mongoose from "mongoose";

const userschema = mongoose.Schema({
  email: {
    type: String,
    required: true,
  },

  name: {
    type: String,
  },

  channelname: {
    type: String,
  },

  description: {
    type: String,
  },

  image: {
    type: String,
  },

  /*
   * Subscription plan
   *
   * Four tiers: free, bronze, silver, gold.
   * Existing users automatically stay on free.
   * Any legacy "premium" value is treated as
   * "free" by the login controller gracefully.
   */

  plan: {
    type: String,
    enum: ["free", "bronze", "silver", "gold"],
    default: "free",
  },

  /*
   * Optional: when the paid subscription expires.
   * Not enforced yet — reserved for future use.
   */
  subscriptionExpiry: {
    type: Date,
    default: null,
  },

  /*
   * Personalized Theme Preferences:
   * theme: "light" | "dark"
   * themePreference: "auto" (time-based IST 10 AM-12 PM light, else dark) | "manual"
   */
  theme: {
    type: String,
    enum: ["light", "dark"],
    default: "light",
  },

  themePreference: {
    type: String,
    enum: ["auto", "manual"],
    default: "auto",
  },

  /*
   * Login Security:
   * Verified devices & locations to detect suspicious/new logins
   */
  devices: [
    {
      deviceId: { type: String, required: true },
      deviceName: { type: String },
      browser: { type: String },
      os: { type: String },
      userAgent: { type: String },
      verifiedAt: { type: Date, default: Date.now },
    },
  ],

  locations: [
    {
      city: { type: String, required: true },
      state: { type: String, required: true },
      country: { type: String },
      lastIp: { type: String },
      verifiedAt: { type: Date, default: Date.now },
    },
  ],

  loginHistory: [
    {
      deviceId: { type: String },
      deviceName: { type: String },
      city: { type: String },
      state: { type: String },
      ip: { type: String },
      loginAt: { type: Date, default: Date.now },
      status: { type: String, default: "success" },
    },
  ],

  joinedon: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.model(
  "user",
  userschema
);