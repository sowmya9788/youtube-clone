import mongoose from "mongoose";

const downloadSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },

    videoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "video",
      required: true,
    },

    videoTitle: {
      type: String,
      required: true,
    },

    filename: {
      type: String,
      required: true,
    },

    userPlan: {
      type: String,
      default: "free",
    },

    downloadDate: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

downloadSchema.index({
  userId: 1,
  downloadDate: 1,
});

export default mongoose.model(
  "download",
  downloadSchema
);