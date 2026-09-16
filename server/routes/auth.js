import express from "express";
import {
  login,
  verifyLoginOtp,
  resendLoginOtp,
  updateTheme,
  updateprofile,
  getChannelById,
} from "../controllers/auth.js";

const routes = express.Router();

routes.post("/login", login);
routes.post("/verify-otp", verifyLoginOtp);
routes.post("/resend-otp", resendLoginOtp);
routes.patch("/theme/:id", updateTheme);
routes.patch("/update/:id", updateprofile);
routes.get("/channel/:id", getChannelById);

export default routes;
