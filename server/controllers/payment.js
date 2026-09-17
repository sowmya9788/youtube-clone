import Razorpay from "razorpay";
import crypto from "crypto";
import nodemailer from "nodemailer";
import Payment from "../Modals/Payment.js";
import User from "../Modals/Auth.js";

/* -------------------------------------------------------
   Plan catalogue
   Prices are in INR; Razorpay expects paise (× 100).
------------------------------------------------------- */
const PLAN_DETAILS = {
  bronze: { label: "Bronze", amountINR: 99,  amountPaise: 9900  },
  silver: { label: "Silver", amountINR: 199, amountPaise: 19900 },
  gold:   { label: "Gold",   amountINR: 499, amountPaise: 49900 },
};

/* -------------------------------------------------------
   Razorpay client (initialised lazily so the server
   still boots even if the env-vars are not set yet).
------------------------------------------------------- */
const getRazorpay = () =>
  new Razorpay({
    key_id:     process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });

/* -------------------------------------------------------
   Nodemailer transporter (Gmail App-Password)
------------------------------------------------------- */
const getMailTransporter = () =>
  nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

/* -------------------------------------------------------
   Send confirmation email after successful payment
------------------------------------------------------- */
const sendConfirmationEmail = async ({
  toEmail,
  userName,
  plan,
  amountINR,
  razorpayPaymentId,
  transactionDate,
}) => {
  try {
    const transporter = getMailTransporter();

    const planLabel =
      PLAN_DETAILS[plan]?.label || plan;

    const formattedDate = new Date(
      transactionDate
    ).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
    });

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
        <div style="background:#dc2626;padding:24px 32px;">
          <h1 style="color:#fff;margin:0;font-size:22px;">YourTube Subscription Confirmed 🎉</h1>
        </div>
        <div style="padding:28px 32px;">
          <p style="margin:0 0 12px;">Hi <strong>${userName || toEmail}</strong>,</p>
          <p style="margin:0 0 20px;">Thank you for upgrading your YourTube plan. Your payment was successful!</p>
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <tr style="background:#f9fafb;">
              <td style="padding:10px 14px;font-weight:600;width:40%;">Plan</td>
              <td style="padding:10px 14px;">${planLabel}</td>
            </tr>
            <tr>
              <td style="padding:10px 14px;font-weight:600;">Amount Paid</td>
              <td style="padding:10px 14px;">₹${amountINR}</td>
            </tr>
            <tr style="background:#f9fafb;">
              <td style="padding:10px 14px;font-weight:600;">Transaction ID</td>
              <td style="padding:10px 14px;word-break:break-all;">${razorpayPaymentId}</td>
            </tr>
            <tr>
              <td style="padding:10px 14px;font-weight:600;">Date &amp; Time</td>
              <td style="padding:10px 14px;">${formattedDate} IST</td>
            </tr>
            <tr style="background:#f9fafb;">
              <td style="padding:10px 14px;font-weight:600;">Status</td>
              <td style="padding:10px 14px;color:#16a34a;font-weight:600;">✓ Paid</td>
            </tr>
          </table>
          <p style="margin:24px 0 0;font-size:13px;color:#6b7280;">
            This is an automated receipt. Please keep it for your records.
            If you have any questions, contact support.
          </p>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: `"YourTube" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: `✅ YourTube ${planLabel} Plan — Payment Confirmed`,
      html,
    });

    console.log(`Confirmation email sent to ${toEmail}`);
  } catch (emailError) {
    /*
     * Do not fail the entire request if email fails.
     * Just log the error.
     */
    console.error("Email send error:", emailError.message);
  }
};

/* =======================================================
   CONTROLLER: POST /payment/create-order
   Body: { userId, plan }
======================================================= */
export const createOrder = async (req, res) => {
  try {
    const { userId, plan } = req.body;

    if (!userId || !plan) {
      return res
        .status(400)
        .json({ message: "userId and plan are required." });
    }

    const planInfo = PLAN_DETAILS[plan];
    if (!planInfo) {
      return res
        .status(400)
        .json({ message: "Invalid plan selected." });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ message: "User not found." });
    }

    /*
     * If Razorpay keys are not configured, handle with mock order
     */
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      const mockOrderId = `demo_order_${Date.now()}`;
      await Payment.create({
        userId,
        plan,
        amount: planInfo.amountINR,
        razorpayOrderId: mockOrderId,
        status: "created",
      });

      return res.status(200).json({
        orderId: mockOrderId,
        amount: planInfo.amountPaise,
        currency: "INR",
        keyId: "demo_key",
        planLabel: planInfo.label,
        isDemo: true,
      });
    }

    /*
     * Create a Razorpay order.
     */
    const razorpay = getRazorpay();

    const order = await razorpay.orders.create({
      amount:   planInfo.amountPaise,
      currency: "INR",
      receipt:  `receipt_${userId}_${Date.now()}`,
      notes: {
        userId: userId.toString(),
        plan,
      },
    });

    /*
     * Persist the order record in a "created" state.
     */
    await Payment.create({
      userId,
      plan,
      amount:          planInfo.amountINR,
      razorpayOrderId: order.id,
      status:          "created",
    });

    return res.status(200).json({
      orderId:  order.id,
      amount:   planInfo.amountPaise,
      currency: "INR",
      keyId:    process.env.RAZORPAY_KEY_ID,
      planLabel: planInfo.label,
    });
  } catch (error) {
    console.error("Create order error:", error);
    return res
      .status(500)
      .json({ message: "Failed to create payment order." });
  }
};

/* =======================================================
   CONTROLLER: POST /payment/demo-subscribe
   Body: { userId, plan }
======================================================= */
export const demoSubscribe = async (req, res) => {
  try {
    const { userId, plan } = req.body;
    if (!userId || !plan) {
      return res.status(400).json({ message: "userId and plan are required." });
    }
    const planInfo = PLAN_DETAILS[plan];
    if (!planInfo && plan !== "free") {
      return res.status(400).json({ message: "Invalid plan selected." });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: { plan } },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found." });
    }

    // Also record in Payment collection for history
    await Payment.create({
      userId,
      plan,
      amount: planInfo ? planInfo.amountINR : 0,
      razorpayOrderId: `demo_order_${Date.now()}`,
      razorpayPaymentId: `demo_pay_${Date.now()}`,
      razorpaySignature: "demo_signature",
      status: "paid",
      transactionDate: new Date(),
    });

    return res.status(200).json({
      success: true,
      message: `Successfully upgraded to ${planInfo?.label || plan} (Demo Mode)!`,
      user: updatedUser,
    });
  } catch (error) {
    console.error("Demo subscribe error:", error);
    return res.status(500).json({ message: "Failed to activate demo subscription." });
  }
};

/* =======================================================
   CONTROLLER: POST /payment/verify
   Body: {
     razorpayOrderId,
     razorpayPaymentId,
     razorpaySignature,
     userId,
     plan
   }
======================================================= */
export const verifyPayment = async (req, res) => {
  try {
    const {
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      userId,
      plan,
    } = req.body;

    if (
      !razorpayOrderId ||
      !razorpayPaymentId ||
      !razorpaySignature ||
      !userId ||
      !plan
    ) {
      return res
        .status(400)
        .json({ message: "Missing required payment details." });
    }

    /*
     * Verify HMAC-SHA256 signature.
     * Expected signature = HMAC(key_secret, orderId + "|" + paymentId)
     */
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest("hex");

    if (expectedSignature !== razorpaySignature) {
      /*
       * Mark payment as failed in DB.
       */
      await Payment.findOneAndUpdate(
        { razorpayOrderId },
        {
          $set: {
            razorpayPaymentId,
            razorpaySignature,
            status: "failed",
          },
        }
      );

      return res
        .status(400)
        .json({ message: "Payment verification failed. Invalid signature." });
    }

    /*
     * Signature valid — update Payment record.
     */
    const paymentRecord = await Payment.findOneAndUpdate(
      { razorpayOrderId },
      {
        $set: {
          razorpayPaymentId,
          razorpaySignature,
          status:          "paid",
          transactionDate: new Date(),
        },
      },
      { new: true }
    );

    /*
     * Update the user's subscription plan.
     */
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: { plan } },
      { new: true }
    );

    /*
     * Send confirmation email (non-blocking).
     */
    const planInfo = PLAN_DETAILS[plan];
    sendConfirmationEmail({
      toEmail:          updatedUser.email,
      userName:         updatedUser.name,
      plan,
      amountINR:        planInfo?.amountINR,
      razorpayPaymentId,
      transactionDate:  paymentRecord?.transactionDate || new Date(),
    });

    return res.status(200).json({
      success: true,
      message: `Successfully upgraded to ${planInfo?.label || plan} plan.`,
      user:    updatedUser,
    });
  } catch (error) {
    console.error("Verify payment error:", error);
    return res
      .status(500)
      .json({ message: "Payment verification failed. Please contact support." });
  }
};

/* =======================================================
   CONTROLLER: GET /payment/status/:userId
   Returns the user's current plan and payment history.
======================================================= */
export const getSubscriptionStatus = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).select(
      "name email plan subscriptionExpiry"
    );

    if (!user) {
      return res
        .status(404)
        .json({ message: "User not found." });
    }

    const payments = await Payment.find({ userId })
      .sort({ transactionDate: -1 })
      .limit(10);

    return res.status(200).json({
      plan:               user.plan,
      subscriptionExpiry: user.subscriptionExpiry,
      payments,
    });
  } catch (error) {
    console.error("Get subscription status error:", error);
    return res
      .status(500)
      .json({ message: "Unable to fetch subscription status." });
  }
};
