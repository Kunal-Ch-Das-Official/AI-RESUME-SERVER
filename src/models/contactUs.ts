import mongoose, { Schema, Document, Model } from "mongoose";

export type EnqueryStatus =
  | "received"
  | "seen"
  | "working"
  | "resolved"
  | "dismiss";

export interface IContactEnquery {
  fullName: string;
  emailId: string;
  subject: string;
  message: string;
  status: EnqueryStatus;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IContactUs extends IContactEnquery, Document {}

const ContactEnquerySchema: Schema<IContactUs> = new Schema<IContactUs>(
  {
    fullName: {
      type: String,
      required: true,
      index: true,
    },
    emailId: {
      type: String,
      required: true,
      trim: true,
    },
    subject: {
      type: String,
      required: true,
      min: 0,
    },
    message: {
      type: String,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ["received", "seen", "working", "resolved", "dismiss"],
      default: "received",
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

const ContactEnqueryModel: Model<IContactUs> =
  mongoose.models.contact_enquerie ||
  mongoose.model<IContactUs>("contact_enquerie", ContactEnquerySchema);

export default ContactEnqueryModel;
