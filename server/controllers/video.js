import fs from "fs";
import { v2 as cloudinary } from "cloudinary";
import video from "../Modals/video.js";

// Check if Cloudinary credentials are provided in environment
const isCloudinaryConfigured = () => {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
};

if (isCloudinaryConfigured()) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME.trim(),
    api_key: process.env.CLOUDINARY_API_KEY.trim(),
    api_secret: process.env.CLOUDINARY_API_SECRET.trim(),
    secure: true,
  });
}

export const uploadvideo = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "Please select a valid video file to upload." });
  }

  let finalFilePath = req.file.path;
  let finalFileSize = req.file.size;

  try {
    if (isCloudinaryConfigured()) {
      console.log(`[Cloudinary] Uploading video "${req.file.originalname}" to cloud storage...`);
      const uploadResult = await cloudinary.uploader.upload(req.file.path, {
        resource_type: "video",
        folder: "yourtube_videos",
      });

      finalFilePath = uploadResult.secure_url;
      finalFileSize = uploadResult.bytes || req.file.size;

      // Clean up temporary local file after successful cloud upload
      try {
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
      } catch (unlinkErr) {
        console.warn("Could not delete temporary file:", unlinkErr.message);
      }
      console.log(`[Cloudinary] Video uploaded successfully: ${finalFilePath}`);
    } else {
      console.log(`[LocalStorage] Cloudinary credentials not configured; saving file locally to: ${finalFilePath}`);
    }

    const newVideo = new video({
      videotitle: req.body.videotitle || req.file.originalname,
      filename: req.file.originalname,
      filepath: finalFilePath,
      filetype: req.file.mimetype || "video/mp4",
      filesize: String(finalFileSize),
      videochanel: req.body.videochanel || "Unknown Channel",
      uploader: req.body.uploader || "Anonymous",
    });

    await newVideo.save();
    return res.status(201).json({
      message: "File uploaded successfully",
      video: newVideo,
    });
  } catch (error) {
    console.error("Upload error:", error);
    if (req.file?.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (_) {}
    }
    return res.status(500).json({ message: error.message || "Failed to upload video" });
  }
};

export const getallvideo = async (req, res) => {
  try {
    const files = await video.find().sort({ createdAt: -1 });
    return res.status(200).json(files);
  } catch (error) {
    console.error("getallvideo error:", error);
    return res.status(500).json({ message: error.message || "Something went wrong" });
  }
};
