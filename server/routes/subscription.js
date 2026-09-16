import express from "express";
import {
  handlesubscribe,
  getSubscriptionStatus,
  getUserSubscriptions,
} from "../controllers/subscription.js";

const routes = express.Router();

routes.post("/toggle", handlesubscribe);
routes.get("/status/:userId/:channelId", getSubscriptionStatus);
routes.get("/user/:userId", getUserSubscriptions);

export default routes;
