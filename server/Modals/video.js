import mongoose from "mongoose";
const videochema = mongoose.Schema(
  {
    videotitle: { type: String, required: true },
    filename: { type: String, required: true },
    filetype: { type: String, required: true },
    filepath: { type: String, required: true },
    filesize: { type: String, required: true },
    videochanel: { type: String, required: true },
    Like: { type: Number, default: 0 },
    views: { type: Number, default: 0 },
    uploader: { type: String },
    // Optional enrichment fields — safe to add; existing documents get defaults
    description: { type: String, default: "" },
    thumbnail: { type: String, default: "" },
    category: { type: String, default: "All" },
    duration: { type: String, default: "" },
    tags: { type: [String], default: [] },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("videofiles", videochema);
