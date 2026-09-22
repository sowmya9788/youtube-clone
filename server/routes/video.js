import express from "express";
import { getallvideo, uploadvideo, getbycategory } from "../controllers/video.js";
import upload from "../filehelper/filehelper.js";

const routes = express.Router();

routes.post("/upload", upload.single("file"), uploadvideo);
routes.get("/getall", getallvideo);
routes.get("/getbycategory/:category", getbycategory);
export default routes;
