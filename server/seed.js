/**
 * seed.js — One-time seed script for YourTube video database
 *
 * Run from the server/ directory:
 *   node seed.js
 *
 * This script:
 *  1. Connects to MongoDB using the existing MONGO_URI from .env
 *  2. Upserts the 3 videos that are already on disk in uploads/
 *  3. Uses the EXACT _ids of the 2 existing DB records so comments/likes/history stay intact
 *  4. Registers the orphan video (no DB record yet)
 *  5. Never creates duplicates — safe to run multiple times
 */

import dotenv from "dotenv";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

// ─── Video Schema (inline copy — same as Modals/video.js) ─────────────────────
const videochema = mongoose.Schema(
  {
    videotitle: { type: String, required: true },
    filename: { type: String, required: true },
    filetype: { type: String, required: true },
    filepath: { type: String, required: true },
    filesize: { type: String, required: true },
    videochanel: { type: String, required: true },
    Like: { type: Number, default: 0 },
    views: { type: Number, default: 0 },
    uploader: { type: String },
    description: { type: String, default: "" },
    thumbnail: { type: String, default: "" },
    category: { type: String, default: "All" },
    duration: { type: String, default: "" },
    tags: { type: [String], default: [] },
  },
  { timestamps: true }
);
const Video = mongoose.models.videofiles || mongoose.model("videofiles", videochema);

// ─── Seed Data ────────────────────────────────────────────────────────────────
// Use the EXACT _ids already in MongoDB so all comments/likes/history links remain intact.
// The orphan video gets a new ID assigned by MongoDB on first insert.
const SEED_VIDEOS = [
  {
    // ── EXISTING VIDEO 1 — preserve exact _id so comments/likes stay linked ──
    _id: "6a620d3807f278e3e36dca98",
    videotitle: "My First Video",
    filename: "vdo.mp4",
    filetype: "video/mp4",
    filepath: "uploads/2026-07-23T12-46-48.257Z-vdo.mp4",
    filesize: "930013",
    videochanel: "Sowmyyy",
    uploader: "6a61df8907f278e3e36dca89",
    description:
      "Welcome to Sowmyyy's channel! This is my very first video — a short intro to who I am and what kind of content you can expect here. Thanks for watching!",
    category: "Entertainment",
    duration: "0:30",
    tags: ["intro", "first video", "vlog"],
  },
  {
    // ── EXISTING VIDEO 2 — preserve exact _id so comments/likes stay linked ──
    _id: "6a620f4907f278e3e36dcae7",
    videotitle: "Christmas",
    filename: "vdo.mp4",
    filetype: "video/mp4",
    filepath: "uploads/2026-07-23T12-55-37.657Z-vdo.mp4",
    filesize: "930013",
    videochanel: "fairy..talessss",
    uploader: "6a61df8907f278e3e36dca87",
    description:
      "Celebrating Christmas with fairy tale vibes! A festive short clip full of holiday cheer. ❄️🎄 Enjoy the season and share with your loved ones.",
    category: "Entertainment",
    duration: "0:30",
    tags: ["christmas", "holiday", "festive", "fairy tales"],
  },
  {
    // ── ORPHAN VIDEO — on disk but no DB record; gets a new auto _id ──
    videotitle: "Sample Video",
    filename: "vdo.mp4",
    filetype: "video/mp4",
    filepath: "uploads/2025-06-25T06-09-29.296Z-vdo.mp4",
    filesize: "930013",
    videochanel: "YourTube",
    uploader: "6a61df8907f278e3e36dca87",
    description:
      "A sample video to demonstrate the YourTube platform. Upload your own content via the channel page!",
    category: "Education",
    duration: "0:30",
    tags: ["sample", "demo", "yourtube"],
  },
];

// ─── Main ─────────────────────────────────────────────────────────────────────
async function seed() {
  const MONGO_URI = process.env.MONGO_URI || process.env.DB_URL;
  if (!MONGO_URI) {
    console.error("❌  MONGO_URI is not set in .env");
    process.exit(1);
  }

  console.log("⏳  Connecting to MongoDB…");
  await mongoose.connect(MONGO_URI, {
    dbName: process.env.DB_NAME || "youtube",
  });
  console.log(`✅  Connected to database: "${mongoose.connection.name}"`);

  for (const data of SEED_VIDEOS) {
    const filter = data._id
      ? { _id: new mongoose.Types.ObjectId(data._id) }
      : { filepath: data.filepath };

    // Build update payload (never overwrite Like/views counters that users accumulated)
    const update = {
      $set: {
        videotitle: data.videotitle,
        filename: data.filename,
        filetype: data.filetype,
        filepath: data.filepath,
        filesize: data.filesize,
        videochanel: data.videochanel,
        uploader: data.uploader,
        description: data.description,
        category: data.category,
        duration: data.duration,
        tags: data.tags,
      },
      // Only set Like/views on first insert — don't reset existing counts
      $setOnInsert: {
        Like: 0,
        views: 0,
      },
    };

    const result = await Video.findOneAndUpdate(filter, update, {
      upsert: true,
      new: true,
      runValidators: true,
    });

    console.log(
      `  ${result ? "✅" : "➕"}  "${data.videotitle}" — _id: ${result._id}`
    );
  }

  const total = await Video.countDocuments();
  console.log(`\n🎬  Seed complete. Total videos in database: ${total}`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("❌  Seed failed:", err.message);
  process.exit(1);
});
