import { Schema, model, Document } from "mongoose";
import { IResumeInfo } from "../types/resume.types.js";

// ==================== Heading Info ====================

const BasicInfoSchema = new Schema(
  {
    fullName: { type: String, required: true },
    position: { type: String, required: true },
  },
  { _id: false },
);

const AvatarSchema = new Schema(
  {
    url: { type: String, required: true },
    key: { type: String, required: true },
  },
  { _id: false },
);

const AddressSchema = new Schema(
  {
    streetName: { type: String, required: true },
    city: { type: String, required: true },
    district: { type: String, required: true },
    pincode: { type: String, required: true },
    country: { type: String, required: true },
  },
  { _id: false },
);

const ContactInfoSchema = new Schema(
  {
    primaryEmail: { type: String, required: true },
    primaryMobile: { type: String, required: true },
    linkedin: { type: String },
    github: { type: String },
    portfolio: { type: String },
  },
  { strict: false, _id: false },
);

const ProfileSummarySchema = new Schema(
  {
    priority: { type: Number, required: true, default: 1 },
    subject: { type: String, required: true },
    objective: { type: String },
  },
  { _id: false },
);

const CompanyItemSchema = new Schema(
  {
    priority: { type: Number, required: true, default: 1 },
    jobTitle: { type: String, required: true },
    jobConditions: { type: String, required: true },
    jobTypes: { type: String, required: true },
    jobLocation: { type: String },
    responsibility: { type: [String] },
    startDate: { type: Schema.Types.Mixed, required: true },
    endDate: { type: Schema.Types.Mixed },
    isPresentJob: { type: Boolean, required: true },
  },
  { strict: false, _id: false },
);

const WorkExperienceSchema = new Schema(
  {
    priority: { type: Number, required: true, default: 2 },
    sectionTitle: { type: String },
    companies: { type: Map, of: CompanyItemSchema, required: true },
  },
  { _id: false },
);

const ProjectItemSchema = new Schema(
  {
    priority: { type: Number, required: true, default: 1 },
    description: { type: String, required: true },
    projectUrl: { type: String },
    startDate: { type: Schema.Types.Mixed, required: true },
    endDate: { type: Schema.Types.Mixed },
    isWorking: { type: Boolean, required: true },
    techStack: { type: [String], required: true },
    skills: { type: [String], required: true },
  },
  { strict: false, _id: false },
);

const ProjectsSchema = new Schema(
  {
    priority: { type: Number, required: true, default: 3 },
    sectionTitle: { type: String },
    projects: { type: Map, of: ProjectItemSchema, required: true },
  },
  { _id: false },
);

const QualificationItemSchema = new Schema(
  {
    priority: { type: Number, required: true, default: 1 },
    institutionName: { type: String, required: true },
    startedAt: { type: Schema.Types.Mixed, required: true },
    yearOfComplete: { type: Schema.Types.Mixed },
    pursuing: { type: Boolean, required: true },
    achivedMarks: { type: Number },
    totalMarks: { type: Number },
    percentage: { type: String },
    description: { type: String },
  },
  { strict: false, _id: false },
);

const EducationsSchema = new Schema(
  {
    priority: { type: Number, required: true, default: 4 },
    sectionTitle: { type: String },
    qualifications: {
      type: Map,
      of: QualificationItemSchema,
      required: true,
    },
  },
  { _id: false },
);

const CertificateContentSchema = new Schema(
  {
    title: { type: String, required: true },
    url: { type: String, required: true },
    key: { type: String, required: true },
  },
  { _id: false },
);

const CertificateItemSchema = new Schema(
  {
    priority: { type: Number, required: true, default: 1 },
    overview: { type: String },
    skillLearned: { type: [String], required: true },
    certificateUrl: { type: String },
    certificateContent: {
      type: CertificateContentSchema,
      required: false,
    },
    duration: { type: String, required: true },
  },
  { strict: false, _id: false },
);

const CertificatesSchema = new Schema(
  {
    priority: { type: Number, required: true, default: 5 },
    sectionTitle: { type: String },
    certificates: {
      type: Map,
      of: CertificateItemSchema,
      required: true,
    },
  },
  { _id: false },
);

const SkillSetSchema = new Schema(
  {
    priority: { type: Number, required: true, default: 6 },
    sectionTitle: { type: String },
    skills: { type: Map, of: [String], required: true },
  },
  { _id: false },
);

const PublicationItemSchema = new Schema(
  {
    priority: { type: Number, required: true, default: 1 },
    description: { type: String },
    referenceUrl: { type: String },
    publicationReference: [
      {
        title: { type: String, required: true },
        accessUrl: {
          url: { type: String, required: true },
          key: { type: String, required: true },
        },
      },
    ],
  },
  { strict: false, _id: false },
);

const PublicationsSchema = new Schema(
  {
    priority: { type: Number, required: true, default: 7 },
    sectionTitle: { type: String },
    publications: {
      type: Map,
      of: PublicationItemSchema,
      required: true,
    },
  },
  { _id: false },
);

const AchievementItemSchema = new Schema(
  {
    priority: { type: Number, required: true, default: 1 },
    title: { type: String },
    description: { type: String },
    url: { type: String },
    documents: [
      {
        title: { type: String, required: true },
        accessUrl: {
          url: { type: String, required: true },
          key: { type: String, required: true },
        },
      },
    ],
  },
  { _id: false },
);

const AwardsAndAchievementsSchema = new Schema(
  {
    priority: { type: Number, required: true, default: 8 },
    sectionTitle: { type: String },
    achievements: {
      type: [AchievementItemSchema],
      required: true,
    },
  },
  { _id: false },
);

const OpenSourceItemSchema = new Schema(
  {
    priority: { type: Number, required: true, default: 1 },
    githubUrl: { type: String },
    description: { type: String },
    duration: { type: String },
  },
  { _id: false },
);

const OpenSourceSchema = new Schema(
  {
    priority: { type: Number, required: true, default: 9 },
    sectionTitle: { type: String },
    contributions: {
      type: Map,
      of: OpenSourceItemSchema,
      required: true,
    },
  },
  { _id: false },
);

const LanguageProficiencyItemSchema = new Schema(
  {
    languageName: { type: String, required: true },
    proficiencyOutOfTen: { type: Number, required: true },
  },
  { _id: false },
);

const LanguageProficiencySchema = new Schema(
  {
    priority: { type: Number, required: true, default: 10 },
    sectionTitle: { type: String },
    languageKnows: {
      type: [LanguageProficiencyItemSchema],
      required: true,
    },
  },
  { _id: false },
);

const HobbiesSchema = new Schema(
  {
    priority: { type: Number, required: true, default: 11 },
    sectionTitle: { type: String },
  },
  { strict: false, _id: false },
);

export interface IResumeDocument extends IResumeInfo, Document {}

const ResumeInfoSchema = new Schema<IResumeDocument>(
  {
    basicInfo: { type: BasicInfoSchema, required: true },
    avatar: { type: AvatarSchema },
    address: { type: AddressSchema, required: true },
    contactInfo: { type: ContactInfoSchema, required: true },
    profileSummary: { type: ProfileSummarySchema, required: true },
    workExperience: { type: WorkExperienceSchema },
    projects: { type: ProjectsSchema },
    educations: { type: EducationsSchema, required: true },
    certifications: { type: CertificatesSchema },
    skills: { type: SkillSetSchema, required: true },
    publications: { type: PublicationsSchema },
    awardsAndAchievements: { type: AwardsAndAchievementsSchema },
    openSource: { type: OpenSourceSchema },
    hobbies: { type: HobbiesSchema },
    languageProficiency: {
      type: LanguageProficiencySchema,
      required: true,
    },
    templateName: { type: String, required: true },
  },
  {
    timestamps: true,
  },
);

export const Resume = model<IResumeDocument>(
  "fresh_resume_information",
  ResumeInfoSchema,
);
