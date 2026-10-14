import infer from "subatom-infer";

// HTTP JSON payloads represent dynamic-key collections as plain objects, not
// native JavaScript Map instances. Use object().catchall(...) for API schemas.

const BasicInfoSchema = infer.object({
  fullName: infer.string(),
  position: infer.string(),
});

const AddressSchema = infer.object({
  streetName: infer.string(),
  city: infer.string(),
  district: infer.string(),
  pincode: infer.string(),
  country: infer.string(),
});

const ContactInfoSchema = infer
  .object({
    primaryEmail: infer.string().email(),
    primaryMobile: infer.string(),
    linkedin: infer.string().url().optional(),
    github: infer.string().url().optional(),
    portfolio: infer.string().url().optional(),
  })
  .catchall(infer.any());

const ProfileSummarySchema = infer.object({
  priority: infer.number(),
  subject: infer.string(),
  objective: infer.string().optional(),
});

const ProjectItemSchema = infer
  .object({
    priority: infer.number(),
    description: infer.string(),
    projectUrl: infer.string().optional(),
    startDate: infer.any(),
    endDate: infer.any().optional(),
    isWorking: infer.boolean(),
    techStack: infer.array(infer.string()),
    skills: infer.array(infer.string()),
  })
  .catchall(infer.any());

const ProjectsSchema = infer.object({
  priority: infer.number(),
  sectionTitle: infer.string().optional(),
  projects: infer.object({}).catchall(ProjectItemSchema),
});

const QualificationItemSchema = infer
  .object({
    priority: infer.number(),
    institutionName: infer.string(),
    startedAt: infer.any(),
    yearOfComplete: infer.any().optional(),
    pursuing: infer.boolean(),
    achivedMarks: infer.number().optional(),
    totalMarks: infer.number().optional(),
    percentage: infer.string().optional(),
    description: infer.string().optional(),
  })
  .catchall(infer.any());

const EducationsSchema = infer.object({
  priority: infer.number(),
  sectionTitle: infer.string().optional(),
  qualifications: infer.object({}).catchall(QualificationItemSchema),
});

const CompanyItemSchema = infer
  .object({
    priority: infer.number(),
    jobTitle: infer.string(),
    jobConditions: infer.string(),
    jobTypes: infer.string(),
    jobLocation: infer.string().optional(),
    responsibility: infer.array(infer.string()).optional(),
    startDate: infer.any(),
    endDate: infer.any().optional(),
    isPresentJob: infer.boolean(),
  })
  .catchall(infer.any());

const WorkExperienceSchema = infer.object({
  priority: infer.number(),
  sectionTitle: infer.string().optional(),
  companies: infer.object({}).catchall(CompanyItemSchema),
});

const SkillSetSchema = infer.object({
  priority: infer.number(),
  sectionTitle: infer.string().optional(),
  skills: infer.object({}).catchall(infer.array(infer.string())),
});

const LanguageProficiencyItemSchema = infer.object({
  languageName: infer.string(),
  proficiencyOutOfTen: infer.number().min(0).max(10),
});

const LanguageProficiencySchema = infer.object({
  priority: infer.number(),
  sectionTitle: infer.string().optional(),
  languageKnows: infer.array(LanguageProficiencyItemSchema),
});

const HobbiesSchema = infer
  .object({
    priority: infer.number(),
    sectionTitle: infer.string().optional(),
  })
  .catchall(infer.any());

/**
 * Metadata stored in body for one uploaded document.
 * `fileIndex` identifies an item in the section's fixed multipart field:
 * `certificateFiles`, `publicationFiles`, or `achievementFiles`.
 */
const FileReferenceSchema = infer.object({
  fileIndex: infer.number().int().min(0),
  title: infer.string(),
});

const CertificateItemSchema = infer
  .object({
    priority: infer.number(),
    overview: infer.string().optional(),
    skillLearned: infer.array(infer.string()),
    certificateUrl: infer.string().url().optional(),
    certificateContent: FileReferenceSchema.optional(),
    duration: infer.string(),
  })
  .catchall(infer.any());

const CertificatesSchema = infer.object({
  priority: infer.number(),
  sectionTitle: infer.string().optional(),
  certificates: infer.object({}).catchall(CertificateItemSchema),
});

const OpenSourceItemSchema = infer.object({
  priority: infer.number(),
  githubUrl: infer.string().url().optional(),
  description: infer.string().optional(),
  duration: infer.string().optional(),
});

const OpenSourceSchema = infer.object({
  priority: infer.number(),
  sectionTitle: infer.string().optional(),
  contributions: infer.object({}).catchall(OpenSourceItemSchema),
});

const PublicationItemSchema = infer
  .object({
    priority: infer.number(),
    description: infer.string().optional(),
    referenceUrl: infer.string().url().optional(),
    publicationReference: infer.array(FileReferenceSchema).optional(),
  })
  .catchall(infer.any());

const PublicationsSchema = infer.object({
  priority: infer.number(),
  sectionTitle: infer.string().optional(),
  publications: infer.object({}).catchall(PublicationItemSchema),
});

const AchievementItemSchema = infer.object({
  priority: infer.number(),
  title: infer.string().optional(),
  description: infer.string().optional(),
  url: infer.string().url().optional(),
  documents: infer.array(FileReferenceSchema).optional(),
});

const AwardsAndAchievementsSchema = infer.object({
  priority: infer.number(),
  sectionTitle: infer.string().optional(),
  achievements: infer.array(AchievementItemSchema),
});

const DocumentFilesSchema = infer
  .files()
  .mime([
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "application/pdf",
  ])
  .extension(["png", "jpg", "jpeg", "webp", "pdf"])
  .minEach(1024)
  .maxEach(5 * 1024 * 1024)
  .storage("memory");

// ==================== Main Resume Schema ====================

export const ResumeInfoSchema = {
  files: infer.object({
    avatar: infer
      .files()
      .mime(["image/png", "image/jpeg", "image/jpg", "image/webp"])
      .extension(["png", "jpg", "jpeg", "webp"])
      .minEach(1024)
      .maxEach(5 * 1024 * 1024)
      .storage("memory")
      .optional(),

    certificateFiles: DocumentFilesSchema.optional(),
    publicationFiles: DocumentFilesSchema.optional(),
    achievementFiles: DocumentFilesSchema.optional(),
  }),
  body: {
    basicInfo: BasicInfoSchema,
    address: AddressSchema,
    contactInfo: ContactInfoSchema,
    profileSummary: ProfileSummarySchema,
    educations: EducationsSchema,
    workExperience: WorkExperienceSchema.optional(),
    skills: SkillSetSchema,
    languageProficiency: LanguageProficiencySchema,
    hobbies: HobbiesSchema.optional(),
    projects: ProjectsSchema.optional(),
    certifications: CertificatesSchema.optional(),
    openSource: OpenSourceSchema.optional(),
    publications: PublicationsSchema.optional(),
    awardsAndAchievements: AwardsAndAchievementsSchema.optional(),
    templateName: infer.string().optional(),
  },
};

export const MultipleResumeIdSchema = {
  query: {
    ids: infer.array(infer.string()).min(0).max(20),
  },
};
