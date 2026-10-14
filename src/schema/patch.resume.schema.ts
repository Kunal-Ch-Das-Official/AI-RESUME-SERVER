import infer from "subatom-infer";

/**
 * PATCH schema for partial resume updates.
 *
 * Every top-level section is optional.
 *
 * Dynamic-key collections are represented as JSON objects because HTTP JSON
 * does not carry native JavaScript Map instances.
 *
 * File references:
 * - `fileIndex` identifies a newly uploaded file in the section's fixed
 *   multipart field (`certificateFiles`, `publicationFiles`, or
 *   `achievementFiles`).
 * - `key` identifies an existing Cloudinary resource.
 * - `title` updates the document title.
 * - `remove` removes the existing document.
 */

const BasicInfoPatchSchema = infer.object({
  fullName: infer.string().optional(),
  position: infer.string().optional(),
});

const AddressPatchSchema = infer.object({
  streetName: infer.string().optional(),
  city: infer.string().optional(),
  district: infer.string().optional(),
  pincode: infer.string().optional(),
  country: infer.string().optional(),
});

const ContactInfoPatchSchema = infer
  .object({
    primaryEmail: infer.string().email().optional(),
    primaryMobile: infer.string().optional(),
    linkedin: infer.string().url().optional(),
    github: infer.string().url().optional(),
    portfolio: infer.string().url().optional(),
  })
  .catchall(infer.any());

const ProfileSummaryPatchSchema = infer.object({
  priority: infer.number().optional(),
  subject: infer.string().optional(),
  objective: infer.string().optional(),
});

const QualificationPatchSchema = infer
  .object({
    remove: infer.boolean().optional(),
    priority: infer.number().optional(),
    institutionName: infer.string().optional(),
    startedAt: infer.any().optional(),
    yearOfComplete: infer.any().optional(),
    pursuing: infer.boolean().optional(),
    achivedMarks: infer.number().optional(),
    totalMarks: infer.number().optional(),
    percentage: infer.string().optional(),
    description: infer.string().optional(),
  })
  .catchall(infer.any());

const EducationsPatchSchema = infer.object({
  priority: infer.number().optional(),
  sectionTitle: infer.string().optional(),
  qualifications: infer
    .object({})
    .catchall(QualificationPatchSchema)
    .optional(),
});

const CompanyPatchSchema = infer
  .object({
    remove: infer.boolean().optional(),
    priority: infer.number().optional(),
    jobTitle: infer.string().optional(),
    jobConditions: infer.string().optional(),
    jobTypes: infer.string().optional(),
    jobLocation: infer.string().optional(),
    responsibility: infer.array(infer.string()).optional(),
    startDate: infer.any().optional(),
    endDate: infer.any().optional(),
    isPresentJob: infer.boolean().optional(),
  })
  .catchall(infer.any());

const WorkExperiencePatchSchema = infer.object({
  priority: infer.number().optional(),
  sectionTitle: infer.string().optional(),
  companies: infer
    .object({})
    .catchall(CompanyPatchSchema)
    .optional(),
});

const SkillSetPatchSchema = infer.object({
  priority: infer.number().optional(),
  sectionTitle: infer.string().optional(),
  skills: infer
    .object({})
    .catchall(infer.array(infer.string()))
    .optional(),
});

const LanguagePatchSchema = infer.object({
  languageName: infer.string(),
  proficiencyOutOfTen: infer.number().min(0).max(10).optional(),
});

const LanguageProficiencyPatchSchema = infer.object({
  priority: infer.number().optional(),
  sectionTitle: infer.string().optional(),
  // Supplied language entries replace/update the language array.
  languageKnows: infer.array(LanguagePatchSchema).optional(),
});

const HobbiesPatchSchema = infer
  .object({
    priority: infer.number().optional(),
    sectionTitle: infer.string().optional(),
  })
  .catchall(infer.any());

const FileReferencePatchSchema = infer.object({
  fileIndex: infer.number().int().min(0).optional(),
  key: infer.string().optional(),
  title: infer.string().optional(),
  remove: infer.boolean().optional(),
});

const CertificatePatchSchema = infer
  .object({
    remove: infer.boolean().optional(),
    priority: infer.number().optional(),
    overview: infer.string().optional(),
    skillLearned: infer.array(infer.string()).optional(),
    certificateUrl: infer.string().url().optional(),
    certificateContent: FileReferencePatchSchema.optional(),
    duration: infer.string().optional(),
  })
  .catchall(infer.any());

const CertificatesPatchSchema = infer.object({
  priority: infer.number().optional(),
  sectionTitle: infer.string().optional(),
  certificates: infer
    .object({})
    .catchall(CertificatePatchSchema)
    .optional(),
});

const OpenSourceItemPatchSchema = infer
  .object({
    remove: infer.boolean().optional(),
    priority: infer.number().optional(),
    githubUrl: infer.string().url().optional(),
    description: infer.string().optional(),
    duration: infer.string().optional(),
  })
  .catchall(infer.any());

const OpenSourcePatchSchema = infer.object({
  priority: infer.number().optional(),
  sectionTitle: infer.string().optional(),
  contributions: infer
    .object({})
    .catchall(OpenSourceItemPatchSchema)
    .optional(),
});

const PublicationPatchSchema = infer
  .object({
    priority: infer.number().optional(),
    description: infer.string().optional(),
    referenceUrl: infer.string().url().optional(),
    publicationReference: infer
      .array(FileReferencePatchSchema)
      .optional(),
  })
  .catchall(infer.any());

const PublicationsPatchSchema = infer.object({
  priority: infer.number().optional(),
  sectionTitle: infer.string().optional(),
  publications: infer
    .object({})
    .catchall(PublicationPatchSchema)
    .optional(),
});

const AchievementPatchSchema = infer.object({
  priority: infer.number().optional(),
  title: infer.string().optional(),
  description: infer.string().optional(),
  url: infer.string().url().optional(),
  documents: infer.array(FileReferencePatchSchema).optional(),
});

const AwardsAndAchievementsPatchSchema = infer.object({
  priority: infer.number().optional(),
  sectionTitle: infer.string().optional(),
  // Supplying achievements replaces the achievements array.
  achievements: infer.array(AchievementPatchSchema).optional(),
});

/**
 * Fixed multipart fields used by the Swagger-friendly resume upload contract.
 */
const DocumentFilesPatchSchema = infer
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

const AvatarPatchSchema = infer.object({
  remove: infer.boolean().optional(),
});

/**
 * PATCH request schema.
 *
 * `avatar` in body is only used to request avatar removal.
 * An uploaded avatar is sent as multipart field `avatar`.
 */
export const ResumePatchSchema = {
  files: infer.object({
    avatar: infer
      .file()
      .mime(["image/png", "image/jpeg", "image/jpg", "image/webp"])
      .extension(["png", "jpg", "jpeg", "webp"])
      .min(1024)
      .max(5 * 1024 * 1024)
      .storage("memory")
      .optional(),
    certificateFiles: DocumentFilesPatchSchema.optional(),
    publicationFiles: DocumentFilesPatchSchema.optional(),
    achievementFiles: DocumentFilesPatchSchema.optional(),
  }),

  params: {
    resumeId: infer.string(),
  },

  body: {
    avatar: AvatarPatchSchema.optional(),

    basicInfo: BasicInfoPatchSchema.optional(),
    address: AddressPatchSchema.optional(),
    contactInfo: ContactInfoPatchSchema.optional(),
    profileSummary: ProfileSummaryPatchSchema.optional(),
    educations: EducationsPatchSchema.optional(),
    workExperience: WorkExperiencePatchSchema.optional(),
    skills: SkillSetPatchSchema.optional(),
    languageProficiency: LanguageProficiencyPatchSchema.optional(),
    hobbies: HobbiesPatchSchema.optional(),
    projects: infer
      .object({
        priority: infer.number().optional(),
        sectionTitle: infer.string().optional(),
        projects: infer
          .object({})
          .catchall(
            infer
              .object({
                remove: infer.boolean().optional(),
                priority: infer.number().optional(),
                description: infer.string().optional(),
                projectUrl: infer.string().optional(),
                startDate: infer.any().optional(),
                endDate: infer.any().optional(),
                isWorking: infer.boolean().optional(),
                techStack: infer.array(infer.string()).optional(),
                skills: infer.array(infer.string()).optional(),
              })
              .catchall(infer.any()),
          )
          .optional(),
      })
      .optional(),
    certifications: CertificatesPatchSchema.optional(),
    openSource: OpenSourcePatchSchema.optional(),
    publications: PublicationsPatchSchema.optional(),
    awardsAndAchievements:
      AwardsAndAchievementsPatchSchema.optional(),

    templateName: infer.string().optional(),
  },
};
