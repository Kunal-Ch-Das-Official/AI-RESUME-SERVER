import mongoose, { Schema, Document, Model } from "mongoose";

export interface IUser {
  userName: string;
  emailId: string;
  fullName: string;
  age: number;
  password: string;
  myResume: string[];
  paymentHistory: string[];
  resumeCredits: number;
  activePlan: string | null;
}

export interface IUserData extends IUser, Document {}

const UserSchema: Schema<IUserData> = new Schema<IUserData>(
  {
    userName: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    emailId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    age: {
      type: Number,
      required: true,
      min: 0,
    },
    password: {
      type: String,
      required: true,
    },
    myResume: {
      type: [String],
      default: [],
    },
    paymentHistory: {
      type: [String],
      default: [],
    },
    resumeCredits: {
      type: Number,
      default: 0,
      min: 0,
    },
    activePlan: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

const UserModel: Model<IUserData> =
  mongoose.models.auth_user ||
  mongoose.models.users_data ||
  mongoose.model<IUserData>("auth_user", UserSchema);

export default UserModel;
