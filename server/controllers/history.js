import mongoose from "mongoose";
import video from "../Modals/video.js";
import history from "../Modals/history.js";
import user from "../Modals/Auth.js";

// Helper to resolve viewer ObjectId safely
const resolveUserId = async (rawUserId) => {
  if (!rawUserId) return null;
  if (mongoose.Types.ObjectId.isValid(rawUserId)) return rawUserId;
  const found = await user.findOne({
    $or: [{ email: String(rawUserId).toLowerCase() }, { _id: rawUserId }],
  });
  return found ? found._id : null;
};

export const handlehistory = async (req, res) => {
  const { userId } = req.body;
  const { videoId } = req.params;

  if (!userId || !videoId || !mongoose.Types.ObjectId.isValid(videoId)) {
    return res.status(400).json({ message: "Valid userId and videoId are required" });
  }

  try {
    const viewerId = await resolveUserId(userId);
    if (viewerId) {
      await history.create({ viewer: viewerId, videoid: videoId });
    }
    await video.findByIdAndUpdate(videoId, { $inc: { views: 1 } });
    return res.status(200).json({ history: true });
  } catch (error) {
    console.error("handlehistory error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const handleview = async (req, res) => {
  const { videoId } = req.params;
  if (!videoId || !mongoose.Types.ObjectId.isValid(videoId)) {
    return res.status(400).json({ message: "Valid videoId is required" });
  }
  try {
    const updated = await video.findByIdAndUpdate(
      videoId,
      { $inc: { views: 1 } },
      { new: true }
    );
    return res.status(200).json({ success: true, views: updated?.views || 0 });
  } catch (error) {
    console.error("handleview error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const getallhistoryVideo = async (req, res) => {
  const { userId } = req.params;
  try {
    const viewerId = await resolveUserId(userId);
    if (!viewerId) {
      return res.status(200).json([]);
    }
    const historyvideo = await history
      .find({ viewer: viewerId })
      .populate({
        path: "videoid",
        model: "videofiles",
      })
      .sort({ createdAt: -1 })
      .exec();
    return res.status(200).json(historyvideo);
  } catch (error) {
    console.error("getallhistoryVideo error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};
