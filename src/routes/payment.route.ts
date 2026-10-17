import { type IRouter, Router } from "subatom";
import {
  createOrderSchema,
  verifyPaymentSchema,
} from "../schema/payment.schema.js";
import createOrderController from "../controllers/payment/createOrder.controller.js";
import verifyPaymentController from "../controllers/payment/verifyPayment.controller.js";
import razorpayWebhookController from "../controllers/payment/webhook.controller.js";
import authorizationMiddleware from "../middlewares/authorization.middleware.js";
import fetchMultiplePaymentController from "../controllers/payment/fetchMultiplePayment.controller.js";

const paymentRouter: IRouter = new Router();

// POST /payment/create-order
paymentRouter.post("/create-order", {
  name: "payment.create_order",
  tags: ["Payment"],
  schema: createOrderSchema,
  middleware: [authorizationMiddleware],
  controller: createOrderController,
});

// POST /payment/verify-payment
paymentRouter.post("/verify-payment", {
  name: "payment.verify_payment",
  tags: ["Payment"],
  schema: verifyPaymentSchema,
  middleware: [authorizationMiddleware],
  controller: verifyPaymentController,
});

// POST /payment/webhook (Unauthenticated; verified by HMAC signature)
paymentRouter.post("/webhook", {
  name: "payment.webhook",
  tags: ["Payment"],
  controller: razorpayWebhookController,
});

paymentRouter.get("/multiple-payment-record", {
  name: "payment.fetch.many",
  tags: ["Payment"],
  middleware: [authorizationMiddleware],
  controller: fetchMultiplePaymentController,
});

export default paymentRouter;
