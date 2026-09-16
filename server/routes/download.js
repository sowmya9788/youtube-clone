import express from "express";
import {
  downloadVideo,
  getUserDownloads,
} from "../controllers/download.js";

const routes = express.Router();

routes.post(
  "/:videoId",
  downloadVideo
);

routes.get(
  "/user/:userId",
  getUserDownloads
);

export default routes;