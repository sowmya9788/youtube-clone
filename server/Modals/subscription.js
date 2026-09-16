import mongoose from "mongoose";

const subscriptionschema = mongoose.Schema(
  {
    viewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    channel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
    },
    channelName: {
      type: String,
      required: true,
    },
    subscribedOn: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

subscriptionschema.index({ viewer: 1, channelName: 1 }, { unique: true });

export default mongoose.model("channelsubscription", subscriptionschema);
