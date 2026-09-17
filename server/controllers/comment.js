import comment from "../Modals/comment.js";
import mongoose from "mongoose";
import user from "../Modals/Auth.js";
import video from "../Modals/video.js";

/* =========================
   ABUSIVE WORDS
========================= */

const abusiveWords = [
  "idiot",
  "stupid",
  "fool",
  "bitch",
  "shit",
  "fuck",
  "asshole",
  "bastard",
];

/* =========================
   ABUSIVE WORD DETECTION
========================= */

const containsAbusiveWords = (text) => {
  const lowerText = text.toLowerCase();

  return abusiveWords.some((word) => {
    const regex = new RegExp(`\\b${word}\\b`, "i");
    return regex.test(lowerText);
  });
};

/* =========================
   REPEATED SPECIAL CHARACTERS
========================= */

const hasRepeatedSpecialCharacters = (text) => {
  const specialCharacters = text.match(
    /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]/g
  );

  if (!specialCharacters) {
    return false;
  }

  const characterCount = {};

  for (const char of specialCharacters) {
    characterCount[char] =
      (characterCount[char] || 0) + 1;

    if (characterCount[char] >= 5) {
      return true;
    }
  }

  return false;
};

/* =========================
   SPAM DETECTION
========================= */

const isSpam = (text) => {
  const lowerText = text.toLowerCase().trim();

  const words = lowerText
    .split(/\s+/)
    .filter(Boolean);

  if (words.length >= 3) {
    const wordCount = {};

    words.forEach((word) => {
      wordCount[word] =
        (wordCount[word] || 0) + 1;
    });

    const repeatedWord =
      Object.values(wordCount).some(
        (count) => count >= 3
      );

    if (repeatedWord) {
      return true;
    }
  }

  const links = lowerText.match(
    /https?:\/\/|www\./g
  );

  if (links && links.length >= 2) {
    return true;
  }

  return false;
};

/* =========================
   VALIDATE COMMENT
========================= */

const validateComment = (text) => {
  if (!text || !text.trim()) {
    return "Comment cannot be empty.";
  }

  if (text.trim().length > 500) {
    return "Comment cannot be longer than 500 characters.";
  }

  if (containsAbusiveWords(text)) {
    return "This comment was blocked because it contains prohibited language.";
  }

  if (hasRepeatedSpecialCharacters(text)) {
    return "This comment was blocked because it contains too many repeated special characters.";
  }

  if (isSpam(text)) {
    return "This comment was blocked because it appears to be spam or repeated content.";
  }

  return null;
};

/* =========================
   POST COMMENT
========================= */

export const postcomment = async (req, res) => {
  const commentbody =
    req.body.commentbody ??
    req.body.comment ??
    req.body.text ??
    "";

  const userid =
    req.body.userid ||
    req.body.userId ||
    req.body.user_id;

  const videoid =
    req.body.videoid ||
    req.body.videoId ||
    req.body.video_id;

  const usercommented =
    req.body.usercommented ||
    req.body.userCommented ||
    req.body.name ||
    req.body.userName ||
    "User";

  const location = req.body.location || "";
  const showLocation = req.body.showLocation === true;

  // 1. Is user ID available?
  if (!userid) {
    return res.status(401).json({
      message: "Please log in before commenting.",
    });
  }

  // 2. Is video ID available?
  if (!videoid) {
    return res.status(400).json({
      message: "Video ID is required.",
    });
  }

  // 3. Is comment text present and non-empty?
  if (typeof commentbody !== "string" || !commentbody.trim()) {
    return res.status(400).json({
      message: "Comment cannot be empty.",
    });
  }

  // 4. Run abusive content detection
  const validationError = validateComment(commentbody);
  if (validationError) {
    return res.status(400).json({
      message: validationError,
      isModerationBlocked: true,
    });
  }

  // 5. Genuine missing required information check
  if (!usercommented) {
    return res.status(400).json({
      message: "Missing required comment information.",
    });
  }

  try {
    // Resolve valid ObjectId for userid
    let finalUserId = userid;
    if (!mongoose.Types.ObjectId.isValid(userid)) {
      const existingUser = await user.findOne({
        $or: [{ email: req.body.email }, { name: usercommented }],
      });
      if (existingUser) {
        finalUserId = existingUser._id;
      } else {
        const createdUser = await user.create({
          name: usercommented,
          email: req.body.email || `${userid}@yourtube.local`,
          plan: "free",
        });
        finalUserId = createdUser._id;
      }
    }

    // Resolve valid ObjectId for videoid
    let finalVideoId = videoid;
    if (!mongoose.Types.ObjectId.isValid(videoid)) {
      const matchedVideo = await video.findOne({});
      if (matchedVideo) {
        finalVideoId = matchedVideo._id;
      }
    }

    const newComment = new comment({
      userid: finalUserId,
      videoid: finalVideoId,
      commentbody: commentbody.trim(),
      usercommented,
      location,
      showLocation,
      likedBy: [],
      dislikedBy: [],
      reportedBy: [],
      reportCount: 0,
      reported: false,
    });

    const savedComment = await newComment.save();

    return res.status(200).json({
      comment: true,
      data: savedComment,
      message: "Comment posted successfully.",
    });
  } catch (error) {
    console.error("Error posting comment:", error);
    return res.status(500).json({
      message: "Something went wrong while posting the comment.",
    });
  }
};

/* =========================
   GET COMMENTS
========================= */

export const getallcomment = async (
  req,
  res
) => {
  const { videoid } = req.params;

  try {
    const comments =
      await comment
        .find({ videoid })
        .sort({ commentedon: -1 });

    return res.status(200).json(comments);
  } catch (error) {
    console.error(
      "Error getting comments:",
      error
    );

    return res.status(500).json({
      message:
        "Something went wrong while loading comments.",
    });
  }
};

/* =========================
   DELETE COMMENT
========================= */

export const deletecomment = async (
  req,
  res
) => {
  const { id } = req.params;

  if (
    !mongoose.Types.ObjectId.isValid(id)
  ) {
    return res.status(404).json({
      message: "Comment unavailable.",
    });
  }

  try {
    await comment.findByIdAndDelete(id);

    return res.status(200).json({
      comment: true,
    });
  } catch (error) {
    console.error(
      "Error deleting comment:",
      error
    );

    return res.status(500).json({
      message:
        "Something went wrong while deleting the comment.",
    });
  }
};

/* =========================
   EDIT COMMENT
========================= */

export const editcomment = async (
  req,
  res
) => {
  const { id } = req.params;
  const { commentbody } = req.body;

  if (
    !mongoose.Types.ObjectId.isValid(id)
  ) {
    return res.status(404).json({
      message: "Comment unavailable.",
    });
  }

  const validationError =
    validateComment(commentbody);

  if (validationError) {
    return res.status(400).json({
      message: validationError,
    });
  }

  try {
    const updatedComment =
      await comment.findByIdAndUpdate(
        id,
        {
          $set: {
            commentbody:
              commentbody.trim(),
          },
        },
        {
          new: true,
        }
      );

    if (!updatedComment) {
      return res.status(404).json({
        message: "Comment not found.",
      });
    }

    return res.status(200).json(
      updatedComment
    );
  } catch (error) {
    console.error(
      "Error editing comment:",
      error
    );

    return res.status(500).json({
      message:
        "Something went wrong while editing the comment.",
    });
  }
};

/* =========================
   LIKE COMMENT
========================= */

export const likecomment = async (
  req,
  res
) => {
  const { id } = req.params;
  const { userid } = req.body;

  if (
    !mongoose.Types.ObjectId.isValid(id) ||
    !mongoose.Types.ObjectId.isValid(userid)
  ) {
    return res.status(400).json({
      message: "Invalid ID.",
    });
  }

  try {
    const existingComment =
      await comment.findById(id);

    if (!existingComment) {
      return res.status(404).json({
        message: "Comment not found.",
      });
    }

    const alreadyLiked =
      existingComment.likedBy.some(
        (userId) =>
          userId.toString() === userid
      );

    const alreadyDisliked =
      existingComment.dislikedBy.some(
        (userId) =>
          userId.toString() === userid
      );

    if (alreadyLiked) {
      existingComment.likedBy =
        existingComment.likedBy.filter(
          (userId) =>
            userId.toString() !== userid
        );
    } else {
      existingComment.likedBy.push(userid);

      if (alreadyDisliked) {
        existingComment.dislikedBy =
          existingComment.dislikedBy.filter(
            (userId) =>
              userId.toString() !== userid
          );
      }
    }

    await existingComment.save();

    return res.status(200).json({
      likes:
        existingComment.likedBy.length,
      dislikes:
        existingComment.dislikedBy.length,
      liked: !alreadyLiked,
      disliked: false,
    });
  } catch (error) {
    console.error(
      "Error liking comment:",
      error
    );

    return res.status(500).json({
      message:
        "Something went wrong while liking the comment.",
    });
  }
};

/* =========================
   DISLIKE COMMENT
========================= */

export const dislikecomment = async (
  req,
  res
) => {
  const { id } = req.params;
  const { userid } = req.body;

  if (
    !mongoose.Types.ObjectId.isValid(id) ||
    !mongoose.Types.ObjectId.isValid(userid)
  ) {
    return res.status(400).json({
      message: "Invalid ID.",
    });
  }

  try {
    const existingComment =
      await comment.findById(id);

    if (!existingComment) {
      return res.status(404).json({
        message: "Comment not found.",
      });
    }

    const alreadyDisliked =
      existingComment.dislikedBy.some(
        (userId) =>
          userId.toString() === userid
      );

    const alreadyLiked =
      existingComment.likedBy.some(
        (userId) =>
          userId.toString() === userid
      );

    if (alreadyDisliked) {
      existingComment.dislikedBy =
        existingComment.dislikedBy.filter(
          (userId) =>
            userId.toString() !== userid
        );
    } else {
      existingComment.dislikedBy.push(userid);

      if (alreadyLiked) {
        existingComment.likedBy =
          existingComment.likedBy.filter(
            (userId) =>
              userId.toString() !== userid
          );
      }
    }

    await existingComment.save();

    return res.status(200).json({
      likes:
        existingComment.likedBy.length,
      dislikes:
        existingComment.dislikedBy.length,
      liked: false,
      disliked: !alreadyDisliked,
    });
  } catch (error) {
    console.error(
      "Error disliking comment:",
      error
    );

    return res.status(500).json({
      message:
        "Something went wrong while disliking the comment.",
    });
  }
};

/* =========================
   REPORT COMMENT
========================= */

export const reportcomment = async (
  req,
  res
) => {
  const { id } = req.params;
  const { userid } = req.body;

  if (
    !mongoose.Types.ObjectId.isValid(id) ||
    !mongoose.Types.ObjectId.isValid(userid)
  ) {
    return res.status(400).json({
      message: "Invalid ID.",
    });
  }

  try {
    const existingComment =
      await comment.findById(id);

    if (!existingComment) {
      return res.status(404).json({
        message: "Comment not found.",
      });
    }

    const alreadyReported =
      existingComment.reportedBy.some(
        (userId) =>
          userId.toString() === userid
      );

    if (alreadyReported) {
      return res.status(400).json({
        message:
          "You have already reported this comment.",
      });
    }

    existingComment.reportedBy.push(userid);

    existingComment.reportCount =
      existingComment.reportedBy.length;

    existingComment.reported = true;

    await existingComment.save();

    return res.status(200).json({
      message:
        "Comment reported and flagged for review.",
      reported: true,
      reportCount:
        existingComment.reportCount,
    });
  } catch (error) {
    console.error(
      "Error reporting comment:",
      error
    );

    return res.status(500).json({
      message:
        "Something went wrong while reporting the comment.",
    });
  }
};