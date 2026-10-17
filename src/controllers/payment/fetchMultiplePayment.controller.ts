import { IController } from "subatom";
import PaymentModel from "../../models/paymentData.js";

const fetchMultiplePaymentController: IController = async (ctx) => {
  // The authenticated user is resolved by the backend middleware.
  // Every payment belonging to this user shares the same userId.
  const userId = (ctx.user as { id: string }).id;

  try {
    if (!userId) {
      return ctx.response.status(401).json({
        message: "Authentication required.",
      });
    }

    // Equality matches every record with this userId, including multiple payments.
    // Newest records are returned first.
    const payments = await PaymentModel.find({ userId }).sort({
      createdAt: -1,
    });

    return ctx.response.status(200).json(payments);
  } catch (error: unknown) {
    return ctx.helper.internal_server_error(
      error instanceof Error
        ? error.message
        : "Could not fetch payment records.",
    );
  }
};

export default fetchMultiplePaymentController;
