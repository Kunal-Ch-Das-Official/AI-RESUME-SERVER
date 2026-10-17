import mongoose from "mongoose";
import { IController } from "subatom";
import { myPaymentSchema } from "../../../schema/auth.schema.js";
import UserModel from "../../../models/usersData.js";
import PaymentModel from "../../../models/paymentData.js";

const addNewPaymentController: IController<typeof myPaymentSchema> = async (
  ctx,
) => {
  const { payment_id } = ctx.body;
  const user_id = (ctx.user as { id: string }).id;

  const user = await UserModel.findById(user_id);
  if (!user) {
    return ctx.helper.not_found("User not found.");
  }

  // Match by MongoDB _id OR Razorpay orderId / paymentId for this user
  const isObjectId = mongoose.Types.ObjectId.isValid(payment_id);
  const paymentRecord = await PaymentModel.findOne(
    isObjectId
      ? { _id: payment_id, userId: user_id }
      : {
          userId: user_id,
          $or: [{ orderId: payment_id }, { paymentId: payment_id }],
        },
  );

  if (!paymentRecord) {
    return ctx.helper.not_found("Requested payment record not found.");
  }

  if (paymentRecord.status !== "paid") {
    return ctx.status(400).json({
      success: false,
      message: "Payment is not marked as paid yet.",
    });
  }

  // Always push the actual MongoDB ObjectId (_id: 6ad30e8628b673641d48a820)
  const updatedUser = await UserModel.findByIdAndUpdate(
    user_id,
    {
      $addToSet: { paymentHistory: paymentRecord._id },
    },
    { new: true },
  );

  if (!updatedUser) {
    return ctx.helper.not_implemented(
      "Unable to add payment information due to some internal server error.",
    );
  }

  return ctx.status(200).json({
    success: true,
    message: "Payment history added.",
    payment_id: paymentRecord._id,
  });
};

export default addNewPaymentController;
