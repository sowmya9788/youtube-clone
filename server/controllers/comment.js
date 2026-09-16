import comment from "../Modals/comment.js";
import mongoose from "mongoose";

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
    return "Your comment contains abusive or inappropriate words.";
  }

  if (hasRepeatedSpecialCharacters(text)) {
    return "Your comment contains too many repeated special characters.";
  }

  if (isSpam(text)) {
    return "Your comment appears to be spam or repeated content.";
  }

  return null;
};

/* =========================
   POST COMMENT
========================= */

export const postcomment = async (req, res) => {
  const {
    userid,
    videoid,
    commentbody,
    usercommented,
    location,
    showLocation,
  } = req.body;

  const validationError =
    validateComment(commentbody);

  if (validationError) {
    return res.status(400).json({
      message: validationError,
    });
  }

  if (!userid || !videoid || !usercommented) {
    return res.status(400).json({
      message:
        "Missing required comment information.",
    });
  }

  try {
    const newComment = new comment({
      userid,
      videoid,
      commentbody: commentbody.trim(),
      usercommented,
      location: location || "",
      showLocation: showLocation === true,
      likedBy: [],
      dislikedBy: [],
      reportedBy: [],
      reportCount: 0,
      reported: false,
    });

    const savedComment =
      await newComment.save();

    return res.status(200).json({
      comment: true,
      data: savedComment,
    });
  } catch (error) {
    console.error(
      "Error posting comment:",
      error
    );

    return res.status(500).json({
      message:
        "Something went wrong while posting the comment.",
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