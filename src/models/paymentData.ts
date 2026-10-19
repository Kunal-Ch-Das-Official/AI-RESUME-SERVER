import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type PaymentStatus = "created" | "paid" | "failed";

export interface IPayment {
  userId: Types.ObjectId;
  planId: string;
  amount: number;
  currency: string;
  orderId: string;
  paymentId: string | null;
  signature: string | null;
  creditsGranted: number;
  status: PaymentStatus;
  receiptEmailStatus: "pending" | "sending" | "sent" | "failed";
  receiptEmailSentAt?: Date | null;
  receiptEmailError?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IPaymentData extends IPayment, Document {}

const PaymentSchema: Schema<IPaymentData> = new Schema<IPaymentData>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "auth_user",
      required: true,
      index: true,
    },
    planId: {
      type: String,
      required: true,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: "INR",
      trim: true,
    },
    orderId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    paymentId: {
      type: String,
      default: null,
      trim: true,
    },
    signature: {
      type: String,
      default: null,
      trim: true,
    },
    creditsGranted: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ["created", "paid", "failed"],
      default: "created",
      index: true,
    },
    receiptEmailStatus: {
      type: String,
      enum: ["pending", "sending", "sent", "failed"],
      default: "pending",
      index: true,
    },
    receiptEmailSentAt: { type: Date, default: null },
    receiptEmailError: { type: String, default: null },
  },
  {
    timestamps: true,
  },
);

const PaymentModel: Model<IPaymentData> =
  mongoose.models.payments_data ||
  mongoose.model<IPaymentData>("payments_data", PaymentSchema);

export default PaymentModel;