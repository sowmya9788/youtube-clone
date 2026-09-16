import fs from "fs";
import path from "path";
import Download from "../Modals/download.js";
import Video from "../Modals/video.js";
import User from "../Modals/Auth.js";

const PLAN_LIMITS = {
  free:   1,
  bronze: 3,
  silver: 10,
  gold:   Infinity, // unlimited
};

/*
 * Returns the daily download limit for a given plan string.
 * Falls back to the free limit for unrecognised values.
 */
const getLimitForPlan = (plan) =>
  PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;

const getTodayRange = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date();
  end.setHours(23, 59, 59, 999);

  return { start, end };
};

export const downloadVideo = async (req, res) => {
  try {
    const { videoId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(401).json({
        message: "Please login to download videos.",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found.",
      });
    }

    const video = await Video.findById(videoId);

    if (!video) {
      return res.status(404).json({
        message: "Video not found.",
      });
    }

    /*
     * User plan
     *
     * Existing users in your database may not have
     * a plan yet, so they automatically become "free".
     */

    const userPlan =
      ["bronze", "silver", "gold"].includes(user.plan)
        ? user.plan
        : "free";

    const limit = getLimitForPlan(userPlan);

    /*
     * Find ALL downloads made by this user today.
     *
     * This is the important part.
     * The count comes from MongoDB, so refreshing
     * or leaving the page cannot reset it.
     */

    const { start, end } = getTodayRange();

    const todayDownloads = await Download.countDocuments({
      userId: userId,
      downloadDate: {
        $gte: start,
        $lte: end,
      },
    });

    if (todayDownloads >= limit && limit !== Infinity) {
      return res.status(429).json({
        message:
          userPlan === "free"
            ? `You have reached your daily free download limit (${PLAN_LIMITS.free} video/day). Upgrade your plan to download more.`
            : `You have reached your daily ${userPlan} download limit of ${limit} videos.`,
        limit,
        used: todayDownloads,
        remaining: 0,
        plan: userPlan,
      });
    }

    /*
     * Check that the actual video file exists
     * before recording a download.
     */

    if (!video.filepath) {
      return res.status(404).json({
        message:
          "The video file could not be found.",
      });
    }

    const filePath = path.resolve(
      video.filepath
    );

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        message:
          "The video file could not be found on the server.",
      });
    }

    /*
     * Clean filename.
     */

    const originalName =
      video.filename ||
      `${video.videotitle}.mp4`;

    const safeFilename =
      originalName.replace(
        /[^a-zA-Z0-9._-]/g,
        "_"
      );

    /*
     * Send the file.
     *
     * The download record is created only after
     * Express successfully finishes sending it.
     */

    res.download(
      filePath,
      safeFilename,
      async (error) => {
        if (error) {
          console.error(
            "Download transfer error:",
            error
          );

          /*
           * If headers haven't been sent, send
           * an error response.
           */

          if (!res.headersSent) {
            return res.status(500).json({
              message:
                "Unable to download the video.",
            });
          }

          return;
        }

        /*
         * Successful download.
         * Permanently save the record.
         */

        try {
          await Download.create({
            userId: userId,
            videoId: video._id,
            videoTitle:
              video.videotitle,
            filename:
              video.filename,
            userPlan: userPlan,
            downloadDate: new Date(),
          });

          console.log(
            `Download recorded: ${userId} -> ${video._id}`
          );
        } catch (saveError) {
          console.error(
            "Could not save download record:",
            saveError
          );
        }
      }
    );
  } catch (error) {
    console.error(
      "Download controller error:",
      error
    );

    if (!res.headersSent) {
      return res.status(500).json({
        message:
          "Something went wrong while downloading the video.",
      });
    }
  }
};

/*
 * Get downloads for the logged-in user's
 * Downloads section.
 */

export const getUserDownloads = async (
  req,
  res
) => {
  try {
    const { userId } = req.params;

    const downloads =
      await Download.find({
        userId,
      })
        .populate("videoId")
        .sort({
          downloadDate: -1,
        });

    const { start, end } =
      getTodayRange();

    const usedToday =
      await Download.countDocuments({
        userId,
        downloadDate: {
          $gte: start,
          $lte: end,
        },
      });

    const user =
      await User.findById(userId);

    const plan =
      ["bronze", "silver", "gold"].includes(user?.plan)
        ? user.plan
        : "free";

    const limit = getLimitForPlan(plan);

    return res.status(200).json({
      downloads,
      plan,
      usedToday,
      limit,
      remaining: Math.max(
        limit - usedToday,
        0
      ),
    });
  } catch (error) {
    console.error(
      "Get downloads error:",
      error
    );

    return res.status(500).json({
      message:
        "Unable to load downloads.",
    });
  }
};