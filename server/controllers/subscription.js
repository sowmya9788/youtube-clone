import mongoose from "mongoose";
import subscription from "../Modals/subscription.js";
import user from "../Modals/Auth.js";
import video from "../Modals/video.js";

// Toggle subscribe / unsubscribe
export const handlesubscribe = async (req, res) => {
  const { userId, channelId, channelName, email, userName } = req.body;

  if (!userId) {
    return res.status(400).json({ message: "userId is required to subscribe" });
  }

  if (!channelId && !channelName) {
    return res.status(400).json({ message: "channelId or channelName is required" });
  }

  try {
    let resolvedViewerId = userId;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      const emailQuery = email ? [{ email: email.toLowerCase() }] : [];
      const matchedViewer = await user.findOne({
        $or: [
          ...emailQuery,
          { email: `${userId}@yourtube.local` },
        ],
      });
      if (matchedViewer) {
        resolvedViewerId = matchedViewer._id;
      } else {
        const createdViewer = await user.create({
          name: userName || "User",
          email: email ? email.toLowerCase() : `${userId}@yourtube.local`,
          plan: "free",
        });
        resolvedViewerId = createdViewer._id;
      }
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
    if (resolvedChannelId && String(resolvedViewerId) === String(resolvedChannelId)) {
      return res.status(400).json({ message: "You cannot subscribe to your own channel" });
    }

    // Query for existing subscription
    const query = {
      viewer: resolvedViewerId,
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
      // Subscribe - use findOneAndUpdate with upsert to prevent duplicate key errors
      const newSub = await subscription.findOneAndUpdate(
        { viewer: resolvedViewerId, channelName: finalChannelName },
        {
          $setOnInsert: {
            viewer: resolvedViewerId,
            channel: resolvedChannelId,
            channelName: finalChannelName,
            subscribedOn: new Date(),
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

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
  const { channelName, email } = req.query;

  try {
    if (!userId) {
      return res.status(200).json({ subscribed: false });
    }

    let resolvedViewerId = userId;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      const emailQuery = email ? [{ email: String(email).toLowerCase() }] : [];
      const matchedViewer = await user.findOne({
        $or: [
          ...emailQuery,
          { email: `${userId}@yourtube.local` },
        ],
      });
      if (matchedViewer) {
        resolvedViewerId = matchedViewer._id;
      } else {
        return res.status(200).json({ subscribed: false });
      }
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
      viewer: resolvedViewerId,
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
  const { email } = req.query;

  try {
    if (!userId) {
      return res.status(200).json({ subscriptions: [], videos: [] });
    }

    let resolvedViewerId = userId;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      const emailQuery = email ? [{ email: String(email).toLowerCase() }] : [];
      const matchedViewer = await user.findOne({
        $or: [
          ...emailQuery,
          { email: `${userId}@yourtube.local` },
        ],
      });
      if (matchedViewer) {
        resolvedViewerId = matchedViewer._id;
      } else {
        return res.status(200).json({ subscriptions: [], videos: [] });
      }
    }

    const subs = await subscription
      .find({ viewer: resolvedViewerId })
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
