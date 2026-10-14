import mongoose, { Schema, Document, Model } from "mongoose";

// 1. Interface representing the raw user data
export interface IUser {
  userName: string;
  emailId: string;
  fullName: string;
  age: number;
  password: string;
  myResume: string[];
  //   avatar?: {
  //     access_url: string;
  //     public_key: string;
  //   } | null;
}

// 2. Interface representing the Mongoose document
export interface IUserData extends IUser, Document {}

// 3. Schema definition
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

    // avatar: {
    //   access_url: {
    //     type: String,
    //     required: true,
    //   },
    //   public_key: {
    //     type: String,
    //     required: true,
    //   },
    // },
  },
  {
    timestamps: true,
  },
);

// 4. Model creation with protection against model re-compilation
const UserModel: Model<IUserData> =
  mongoose.models.users_data ||
  mongoose.model<IUserData>("auth_user", UserSchema);

export default UserModel;
