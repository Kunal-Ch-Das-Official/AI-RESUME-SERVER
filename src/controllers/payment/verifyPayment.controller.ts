import { IController } from "subatom";
import crypto from "crypto";
import { verifyPaymentSchema } from "../../schema/payment.schema.js";
import { getPlanById } from "../../config/plans.js";
import PaymentModel from "../../models/paymentData.js";
import UserModel from "../../models/usersData.js";
import envConfig from "../../config/envConfig.js";
import sendPaymentConfirmationEmail from "../../emails/sendPaymentConfirmationEmail.js";

const verifyPaymentController: IController<typeof verifyPaymentSchema> = async (
  ctx,
) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, planId } =
    ctx.body;
  const user = ctx.user as { id?: string };
  const userId = user.id;

  if (!userId) {
    return ctx.helper.unauthorized("Authentication required.");
  }

  const plan = getPlanById(planId);
  if (!plan) {
    return ctx.helper.bad_request("Invalid plan identifier.");
  }

  const secret =
    envConfig.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET || "";

  // 1. Verify cryptographic HMAC-SHA256 signature
  const bodyToSign = `${razorpay_order_id}|${razorpay_payment_id}`;
  const generatedSignature = crypto
    .createHmac("sha256", secret)
    .update(bodyToSign)
    .digest("hex");

  const isSignatureValid =
    generatedSignature.length === razorpay_signature.length &&
    crypto.timingSafeEqual(
      Buffer.from(generatedSignature, "utf-8"),
      Buffer.from(razorpay_signature, "utf-8"),
    );

  if (!isSignatureValid) {
    await PaymentModel.findOneAndUpdate(
      { orderId: razorpay_order_id },
      {
        status: "failed",
        paymentId: razorpay_payment_id,
        signature: razorpay_signature,
      },
    );
    return ctx.helper.bad_request("Invalid payment signature.");
  }

  // 2. Fetch order record
  const paymentRecord = await PaymentModel.findOne({
    orderId: razorpay_order_id,
  });
  if (!paymentRecord) {
    return ctx.helper.not_found("Payment order record not found.");
  }

  // 3. Replay attack check: If order is already paid, return 200 OK immediately
  if (paymentRecord.status === "paid") {
    // The email helper is idempotent and also retries a previously failed email.
    await sendPaymentConfirmationEmail(paymentRecord._id.toString());
    const existingUser = await UserModel.findById(userId);
    return ctx.status(200).json({
      success: true,
      message: "Payment already verified and processed.",
      alreadyProcessed: true,
      user: {
        id: existingUser?._id,
        resumeCredits: existingUser?.resumeCredits || 0,
        activePlan: existingUser?.activePlan,
        resumesUsed: existingUser?.myResume?.length || 0,
      },
    });
  }

  // 4. Update PaymentModel status atomically to prevent race condition with webhook
  const updatedPayment = await PaymentModel.findOneAndUpdate(
    { orderId: razorpay_order_id, status: { $ne: "paid" } },
    {
      status: "paid",
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
    },
    { new: true },
  );

  if (!updatedPayment) {
    await sendPaymentConfirmationEmail(paymentRecord._id.toString());
    const existingUser = await UserModel.findById(userId);
    return ctx.status(200).json({
      success: true,
      message: "Payment processed concurrently.",
      user: {
        id: existingUser?._id,
        resumeCredits: existingUser?.resumeCredits || 0,
        activePlan: existingUser?.activePlan,
      },
    });
  }

  // 5. Increment user credits atomically
  const updatedUser = await UserModel.findByIdAndUpdate(
    userId,
    {
      $inc: { resumeCredits: plan.resumes },
      $set: { activePlan: plan.id },
    },
    { new: true },
  );

  if (!updatedUser) {
    return ctx.helper.not_found("User record not found.");
  }

  // Payment and credits are committed before attempting email delivery.
  // Email failure must not turn a successful payment into a failed response.
  await sendPaymentConfirmationEmail(updatedPayment._id.toString());

  const resumesUsed = updatedUser.myResume?.length || 0;
  const remainingCredits = Math.max(0, updatedUser.resumeCredits - resumesUsed);

  return ctx.status(200).json({
    success: true,
    message: "Payment verified and credits added successfully.",
    payment: {
      orderId: updatedPayment.orderId,
      paymentId: updatedPayment.paymentId,
      creditsGranted: updatedPayment.creditsGranted,
      status: updatedPayment.status,
    },
    user: {
      id: updatedUser._id,
      resumeCredits: updatedUser.resumeCredits,
      activePlan: updatedUser.activePlan,
      resumesUsed,
      remainingCredits,
    },
  });
};

export default verifyPaymentController;
