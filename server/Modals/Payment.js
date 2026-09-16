import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },

    plan: {
      type: String,
      enum: ["bronze", "silver", "gold"],
      required: true,
    },

    /*
     * Amount stored in INR (not paise).
     * e.g. 99, 199, 499
     */
    amount: {
      type: Number,
      required: true,
    },

    /*
     * Razorpay identifiers
     */
    razorpayOrderId: {
      type: String,
      required: true,
    },

    razorpayPaymentId: {
      type: String,
      default: null,
    },

    razorpaySignature: {
      type: String,
      default: null,
    },

    /*
     * "created"  — order created, payment not done yet
     * "paid"     — payment verified successfully
     * "failed"   — verification failed
     */
    status: {
      type: String,
      enum: ["created", "paid", "failed"],
      default: "created",
    },

    transactionDate: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model(
  "payment",
  paymentSchema
);
