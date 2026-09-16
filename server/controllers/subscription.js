import mongoose from "mongoose";
import subscription from "../Modals/subscription.js";
import user from "../Modals/Auth.js";
import video from "../Modals/video.js";

// Toggle subscribe / unsubscribe
export const handlesubscribe = async (req, res) => {
  const { userId, channelId, channelName } = req.body;

  if (!userId) {
    return res.status(400).json({ message: "userId is required to subscribe" });
  }

  if (!channelId && !channelName) {
    return res.status(400).json({ message: "channelId or channelName is required" });
  }

  try {
    const isValidViewerId = mongoose.Types.ObjectId.isValid(userId);
    if (!isValidViewerId) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const isValidChannelId = mongoose.Types.ObjectId.isValid(channelId);

    // Resolve channel name and user document
    let finalChannelName = channelName;
    let resolvedChannelId = isValidChannelId ? channelId : undefined;

    if (isValidChannelId) {
      const channelUser = await user.findById(channelId);
      if (channelUser) {
        finalChannelName = channelUser.channelname || channelUser.name || finalChannelName;
      }
    } else if (finalChannelName) {
      const matchedUser = await user.findOne({
        $or: [{ channelname: finalChannelName }, { name: finalChannelName }],
      });
      if (matchedUser) {
        resolvedChannelId = matchedUser._id;
      }
    }

    if (!finalChannelName) finalChannelName = "Channel";

    // Prevent self-subscription
    if (resolvedChannelId && String(userId) === String(resolvedChannelId)) {
      return res.status(400).json({ message: "You cannot subscribe to your own channel" });
    }

    // Query for existing subscription
    const query = {
      viewer: userId,
      $or: [
        { channelName: finalChannelName },
        ...(resolvedChannelId ? [{ channel: resolvedChannelId }] : []),
      ],
    };

    const existing = await subscription.findOne(query);

    if (existing) {
      // Unsubscribe
      await subscription.findByIdAndDelete(existing._id);
      return res.status(200).json({
        subscribed: false,
        channelName: finalChannelName,
        channelId: resolvedChannelId || channelId,
        message: `Unsubscribed from ${finalChannelName}`,
      });
    } else {
      // Subscribe
      const newSub = await subscription.create({
        viewer: userId,
        channel: resolvedChannelId,
        channelName: finalChannelName,
      });
      const populatedSub = await subscription
        .findById(newSub._id)
        .populate("channel", "name channelname description image");
      return res.status(200).json({
        subscribed: true,
        subscription: populatedSub,
        message: `Subscribed to ${finalChannelName}`,
      });
    }
  } catch (error) {
    console.error("handlesubscribe error:", error);
    return res.status(500).json({ message: error.message || "Something went wrong" });
  }
};

// Check if a user is subscribed to a specific channel
export const getSubscriptionStatus = async (req, res) => {
  const { userId, channelId } = req.params;
  const { channelName } = req.query;

  try {
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(200).json({ subscribed: false });
    }

    const isValidChannelId = mongoose.Types.ObjectId.isValid(channelId);
    const orConditions = [];

    if (channelName) {
      orConditions.push({ channelName: String(channelName) });
    }
    if (isValidChannelId) {
      orConditions.push({ channel: channelId });
    }
    if (channelId && !isValidChannelId) {
      orConditions.push({ channelName: String(channelId) });
    }

    if (orConditions.length === 0) {
      return res.status(200).json({ subscribed: false });
    }

    const existing = await subscription.findOne({
      viewer: userId,
      $or: orConditions,
    });

    return res.status(200).json({ subscribed: Boolean(existing) });
  } catch (error) {
    console.error("getSubscriptionStatus error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// Get all subscriptions and their videos for a user
export const getUserSubscriptions = async (req, res) => {
  const { userId } = req.params;

  try {
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const subs = await subscription
      .find({ viewer: userId })
      .populate("channel", "name channelname description image")
      .sort({ createdAt: -1 });

    const channelNames = subs.map((s) => s.channelName).filter(Boolean);
    const channelIds = subs
      .map((s) => (s.channel?._id ? s.channel._id.toString() : s.channel?.toString()))
      .filter(Boolean);

    let subscribedVideos = [];
    if (channelNames.length > 0 || channelIds.length > 0) {
      subscribedVideos = await video
        .find({
          $or: [
            ...(channelNames.length > 0 ? [{ videochanel: { $in: channelNames } }] : []),
            ...(channelIds.length > 0 ? [{ uploader: { $in: channelIds } }] : []),
          ],
        })
        .sort({ createdAt: -1 });
    }

    return res.status(200).json({
      subscriptions: subs,
      videos: subscribedVideos,
    });
  } catch (error) {
    console.error("getUserSubscriptions error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};
