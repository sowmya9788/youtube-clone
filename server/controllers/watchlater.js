import mongoose from "mongoose";
import watchlater from "../Modals/watchlater.js";
import user from "../Modals/Auth.js";

const resolveUserId = async (rawUserId) => {
  if (!rawUserId) return null;
  if (mongoose.Types.ObjectId.isValid(rawUserId)) return rawUserId;
  const found = await user.findOne({
    $or: [{ email: String(rawUserId).toLowerCase() }, { _id: rawUserId }],
  });
  return found ? found._id : null;
};

export const handlewatchlater = async (req, res) => {
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

    const exisitingwatchlater = await watchlater.findOne({
      viewer: viewerId,
      videoid: videoId,
    });
    if (exisitingwatchlater) {
      await watchlater.findByIdAndDelete(exisitingwatchlater._id);
      return res.status(200).json({ watchlater: false });
    } else {
      await watchlater.create({ viewer: viewerId, videoid: videoId });
      return res.status(200).json({ watchlater: true });
    }
  } catch (error) {
    console.error("handlewatchlater error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const getallwatchlater = async (req, res) => {
  const { userId } = req.params;
  try {
    const viewerId = await resolveUserId(userId);
    if (!viewerId) {
      return res.status(200).json([]);
    }
    const watchlatervideo = await watchlater
      .find({ viewer: viewerId })
      .populate({
        path: "videoid",
        model: "videofiles",
      })
      .sort({ createdAt: -1 })
      .exec();
    return res.status(200).json(watchlatervideo);
  } catch (error) {
    console.error("getallwatchlater error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};
