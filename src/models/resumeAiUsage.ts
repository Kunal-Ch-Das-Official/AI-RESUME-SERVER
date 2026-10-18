import mongoose, { Schema, Document, Model } from "mongoose";

export interface IAiFeaturesUsed {
  oldResumeUploadFeat: number;
  profileSummaryFeat: number;
  experienceFeat: number;
  projectFeat: number;
  achievementsFeat: number;
  openSourceFeat: number;
  atsCheckFeat: number;
  resumePolish: number;
}

export interface IResumeAiUsage extends Document {
  userId: string;
  resumeId: string;
  features: IAiFeaturesUsed;
  totalCalls: number;
  creditDeducted: boolean;
  deductedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const AiFeaturesSchema = new Schema<IAiFeaturesUsed>(
  {
    oldResumeUploadFeat: { type: Number, default: 0 },
    profileSummaryFeat: { type: Number, default: 0 },
    experienceFeat: { type: Number, default: 0 },
    projectFeat: { type: Number, default: 0 },
    achievementsFeat: { type: Number, default: 0 },
    openSourceFeat: { type: Number, default: 0 },
    atsCheckFeat: { type: Number, default: 0 },
    resumePolish: { type: Number, default: 0 },
  },
  { _id: false },
);

const ResumeAiUsageSchema = new Schema<IResumeAiUsage>(
  {
    userId: { type: String, required: true, index: true },
    resumeId: { type: String, required: true, unique: true, index: true },
    features: { type: AiFeaturesSchema, default: () => ({}) },
    totalCalls: { type: Number, default: 0 },
    creditDeducted: { type: Boolean, default: false },
    deductedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  },
);

export const ResumeAiUsage: Model<IResumeAiUsage> =
  mongoose.models.ResumeAiUsage ||
  mongoose.model<IResumeAiUsage>("ResumeAiUsage", ResumeAiUsageSchema);
