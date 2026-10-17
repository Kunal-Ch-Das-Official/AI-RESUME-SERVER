import { IController } from "subatom";
import { createOrderSchema } from "../../schema/payment.schema.js";
import { getPlanById } from "../../config/plans.js";
import PaymentModel from "../../models/paymentData.js";
import razorpay from "../../config/razorpay.js";

const createOrderController: IController<typeof createOrderSchema> = async (ctx) => {
  const { planId } = ctx.body;
  const user = ctx.user as { id?: string };
  const userId = user.id;

  if (!userId) {
    return ctx.helper.unauthorized("Authentication required to purchase a plan.");
  }

  const plan = getPlanById(planId);
  if (!plan) {
    return ctx.helper.bad_request("Invalid plan selected.");
  }

  if (plan.priceInPaise <= 0) {
    return ctx.helper.bad_request("Free plan does not require a payment transaction.");
  }

  try {
    const receipt = `rcpt_${Date.now().toString(36)}_${String(userId).slice(-4)}`;

    const razorpayOrder = await razorpay.orders.create({
      amount: plan.priceInPaise,
      currency: "INR",
      receipt,
      notes: {
        userId: String(userId),
        planId: plan.id,
        credits: String(plan.resumes),
      },
    });

    await PaymentModel.create({
      userId,
      planId: plan.id,
      amount: razorpayOrder.amount as number,
      currency: razorpayOrder.currency,
      orderId: razorpayOrder.id,
      creditsGranted: plan.resumes,
      status: "created",
    });

    return ctx.status(200).json({
      success: true,
      orderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
    });
  } catch (error: unknown) {
    return ctx.status(500).json({
      success: false,
      message: "Failed to create Razorpay order.",
      error: (error as Error).message  || "Internal server error",
    });
  }
};

export default createOrderController;