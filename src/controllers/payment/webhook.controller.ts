import { IController } from "subatom";
import crypto from "crypto";
import PaymentModel from "../../models/paymentData.js";
import UserModel from "../../models/usersData.js";
import envConfig from "../../config/envConfig.js";
import { getPlanById } from "../../config/plans.js";

const razorpayWebhookController: IController = async (ctx) => {
  const webhookSecret = envConfig.RAZORPAY_WEBHOOK_SECRET;
  const signatureHeader = (ctx.headers?.["x-razorpay-signature"] ||
    ctx.headers?.["X-Razorpay-Signature"]) as string;

  if (!signatureHeader || !webhookSecret) {
    return ctx
      .status(400)
      .json({ error: "Missing signature or webhook secret configuration." });
  }

  const payloadString =
    typeof ctx.body === "string" ? ctx.body : JSON.stringify(ctx.body);

  const expectedSignature = crypto
    .createHmac("sha256", webhookSecret)
    .update(payloadString)
    .digest("hex");

  const isValid =
    expectedSignature.length === signatureHeader.length &&
    crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(signatureHeader),
    );

  if (!isValid) {
    return ctx.status(400).json({ error: "Invalid webhook signature." });
  }

  const event = typeof ctx.body === "string" ? JSON.parse(ctx.body) : ctx.body;

  // Background reconciliation for order.paid and payment.captured
  if (event.event === "order.paid" || event.event === "payment.captured") {
    const orderEntity = event.payload?.order?.entity;
    const paymentEntity = event.payload?.payment?.entity;

    const orderId = orderEntity?.id || paymentEntity?.order_id;
    const paymentId = paymentEntity?.id;

    if (!orderId) {
      return ctx
        .status(200)
        .json({ message: "No order ID associated with event." });
    }

    // Atomic check: only credit if the payment is not already marked "paid"
    const paymentRecord = await PaymentModel.findOneAndUpdate(
      { orderId, status: { $ne: "paid" } },
      {
        status: "paid",
        paymentId: paymentId || null,
        signature: signatureHeader,
      },
      { new: true },
    );

    if (paymentRecord) {
      const plan = getPlanById(paymentRecord.planId);
      const creditsToAdd = plan?.resumes ?? paymentRecord.creditsGranted;

      await UserModel.findByIdAndUpdate(paymentRecord.userId, {
        $inc: { resumeCredits: creditsToAdd },
        $set: { activePlan: paymentRecord.planId },
      });
    }
  }

  return ctx.status(200).json({ status: "ok" });
};

export default razorpayWebhookController;
