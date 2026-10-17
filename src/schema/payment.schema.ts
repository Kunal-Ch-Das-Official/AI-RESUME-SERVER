import infer from "subatom-infer";

export const createOrderSchema = {
  body: {
    planId: infer.string(),
  },
};

export const verifyPaymentSchema = {
  body: {
    razorpay_order_id: infer.string(),
    razorpay_payment_id: infer.string(),
    razorpay_signature: infer.string(),
    planId: infer.string(),
  },
};
