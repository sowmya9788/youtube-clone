import mongoose from "mongoose";
import video from "../Modals/video.js";
import like from "../Modals/like.js";
import user from "../Modals/Auth.js";

const resolveUserId = async (rawUserId) => {
  if (!rawUserId) return null;
  if (mongoose.Types.ObjectId.isValid(rawUserId)) return rawUserId;
  const found = await user.findOne({
    $or: [{ email: String(rawUserId).toLowerCase() }, { _id: rawUserId }],
  });
  return found ? found._id : null;
};

export const handlelike = async (req, res) => {
  const { userId } = req.body;
  const { videoId } = req.params;

  if (!userId || !videoId || !mongoose.Types.ObjectId.isValid(videoId)) {
    return res.status(400).json({ message: "Valid userId and videoId are required" });
  }

  try {
    const viewerId = await resolveUserId(userId);
    if (!viewerId) {
      return res.status(404).json({ message: "User not found" });
    }

    const exisitinglike = await like.findOne({
      viewer: viewerId,
      videoid: videoId,
    });
    if (exisitinglike) {
      await like.findByIdAndDelete(exisitinglike._id);
      await video.findByIdAndUpdate(videoId, { $inc: { Like: -1 } });
      return res.status(200).json({ liked: false });
    } else {
      await like.create({ viewer: viewerId, videoid: videoId });
      await video.findByIdAndUpdate(videoId, { $inc: { Like: 1 } });
      return res.status(200).json({ liked: true });
    }
  } catch (error) {
    console.error("handlelike error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const getallLikedVideo = async (req, res) => {
  const { userId } = req.params;
  try {
    const viewerId = await resolveUserId(userId);
    if (!viewerId) {
      return res.status(200).json([]);
    }
    const likevideo = await like
      .find({ viewer: viewerId })
      .populate({
        path: "videoid",
        model: "videofiles",
      })
      .sort({ createdAt: -1 })
      .exec();
    return res.status(200).json(likevideo);
  } catch (error) {
    console.error("getallLikedVideo error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};
