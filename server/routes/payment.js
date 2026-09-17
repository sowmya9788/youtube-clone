import express from "express";
import {
  createOrder,
  verifyPayment,
  getSubscriptionStatus,
  demoSubscribe,
} from "../controllers/payment.js";

const routes = express.Router();

/* POST /payment/demo-subscribe  — activate demo plan without Razorpay keys */
routes.post("/demo-subscribe", demoSubscribe);

/* POST /payment/create-order   — create a Razorpay order  */
routes.post("/create-order", createOrder);

/* POST /payment/verify         — verify & confirm payment  */
routes.post("/verify", verifyPayment);

/* GET  /payment/status/:userId — get plan + history        */
routes.get("/status/:userId", getSubscriptionStatus);

export default routes;
