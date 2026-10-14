/* eslint-disable @typescript-eslint/no-unused-vars */
import { randomUUID } from "node:crypto";
import type { IController } from "subatom";
import { ResumeInfoSchema } from "../../schema/resume.schema.js";
import { Resume } from "../../models/resumeInfo.js";
import {
  TypeFile,
  UploadResult,
} from "../../middlewares/blob-operations/fileUploader.types.js";
import cloudUploader from "../../middlewares/blob-operations/cloudUploader.js";
import cloudDestroyerMany from "../../middlewares/blob-operations/cloudDestroyerMany.js";

interface FileReference {
  fileIndex: number;
  title: string;
}

type DocumentFieldName =
  | "certificateFiles"
  | "publicationFiles"
  | "achievementFiles";

interface UploadReference extends FileReference {
  fieldName: DocumentFieldName;
}

interface RuntimeUploadedFile {
  filename?: string;
  originalname?: string;
  encoding?: string;
  mimetype?: string;
  size?: number;
  bufferContent?: Buffer;
  buffer?: Buffer | (() => Promise<Buffer>);
}

type FileMap = Record<string, unknown>;


const UPLOAD_CONCURRENCY = 4;

function getFileMap(files: unknown): FileMap {
  if (!files || typeof files !== "object" || Array.isArray(files)) {
    return {};
  }

  return files as FileMap;
}

function getFileEntries(
  files: FileMap,
  fieldName: string,
): RuntimeUploadedFile[] {
  const value = files[fieldName];

  if (Array.isArray(value)) {
    return value.filter(Boolean) as RuntimeUploadedFile[];
  }

  if (value && typeof value === "object") {
    return [value as RuntimeUploadedFile];
  }

  return [];
}

function collectFileReferences(body: {
  certifications?: {
    certificates: Record<
      string,
      { certificateContent?: FileReference | undefined }
    >;
  };
  publications?: {
    publications: Record<
      string,
      {
        publicationReference?: FileReference[];
      }
    >;
  };
  awardsAndAchievements?: {
    achievements: Array<{
      documents?: FileReference[];
    }>;
  };
}): UploadReference[] {
  const references: UploadReference[] = [];

  for (const certificate of Object.values(
    body.certifications?.certificates ?? {},
  )) {
    if (certificate.certificateContent) {
      references.push({
        ...certificate.certificateContent,
        fieldName: "certificateFiles",
      });
    }
  }

  for (const publication of Object.values(
    body.publications?.publications ?? {},
  )) {
    references.push(
      ...(publication.publicationReference ?? []).map((reference) => ({
        ...reference,
        fieldName: "publicationFiles" as const,
      })),
    );
  }

  for (const achievement of body.awardsAndAchievements?.achievements ?? []) {
    references.push(
      ...(achievement.documents ?? []).map((reference) => ({
        ...reference,
        fieldName: "achievementFiles" as const,
      })),
    );
  }

  return references;
}

function uploadReferenceKey(
  reference: Pick<UploadReference, "fieldName" | "fileIndex">,
): string {
  return `${reference.fieldName}:${reference.fileIndex}`;
}

function validateUniqueFileIndexes(
  references: UploadReference[],
): string | null {
  const seen = new Set<string>();

  for (const reference of references) {
    const key = uploadReferenceKey(reference);
    if (seen.has(key)) {
      return `Duplicate fileIndex '${reference.fileIndex}' was supplied for '${reference.fieldName}'.`;
    }

    seen.add(key);
  }

  return null;
}

/**
 * Convert a plain JSON object into a native Map.
 *
 * The HTTP API deliberately uses JSON objects because JSON has no native
 * Map type. The Mongoose schema, however, uses Schema.Types.Map, so the
 * persistence layer needs actual Map instances.
 */
function toMap<T>(
  value: Record<string, T> | null | undefined,
): Map<string, T> | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (value instanceof Map) {
    return value;
  }

  return new Map(Object.entries(value));
}

/**
 * Convert every dynamic-key JSON object required by the Mongoose schema
 * into a real Map before persistence.
 *
 * The external API remains object-based; this conversion exists only at
 * the database boundary.
 */
function prepareMongooseMaps(body: {
  educations?: {
    priority: number;
    sectionTitle?: string;
    qualifications: Record<string, unknown>;
  };
  workExperience?: {
    priority: number;
    sectionTitle?: string;
    companies: Record<string, unknown>;
  };
  skills?: {
    priority: number;
    sectionTitle?: string;
    skills: Record<string, string[]>;
  };
  projects?: {
    priority: number;
    sectionTitle?: string;
    projects: Record<string, unknown>;
  };
  certifications?: {
    priority: number;
    sectionTitle?: string;
    certificates: Record<string, unknown>;
  };
  openSource?: {
    priority: number;
    sectionTitle?: string;
    contributions: Record<string, unknown>;
  };
  publications?: {
    priority: number;
    sectionTitle?: string;
    publications: Record<string, unknown>;
  };
}) {
  return {
    educations: body.educations
      ? {
          ...body.educations,
          qualifications: toMap(body.educations.qualifications),
        }
      : undefined,

    workExperience: body.workExperience
      ? {
          ...body.workExperience,
          companies: toMap(body.workExperience.companies),
        }
      : undefined,

    skills: body.skills
      ? {
          ...body.skills,
          skills: toMap(body.skills.skills),
        }
      : undefined,

    projects: body.projects
      ? {
          ...body.projects,
          projects: toMap(body.projects.projects),
        }
      : undefined,

    certifications: body.certifications
      ? {
          ...body.certifications,
          certificates: toMap(body.certifications.certificates),
        }
      : undefined,

    openSource: body.openSource
      ? {
          ...body.openSource,
          contributions: toMap(body.openSource.contributions),
        }
      : undefined,

    publications: body.publications
      ? {
          ...body.publications,
          publications: toMap(body.publications.publications),
        }
      : undefined,
  };
}

async function toTypeFile(
  uploaded: RuntimeUploadedFile,
  fieldname: string,
): Promise<TypeFile> {
  let buffer: Buffer | undefined;

  if (Buffer.isBuffer(uploaded.bufferContent)) {
    buffer = uploaded.bufferContent;
  } else if (Buffer.isBuffer(uploaded.buffer)) {
    buffer = uploaded.buffer;
  } else if (typeof uploaded.buffer === "function") {
    const resolved = await uploaded.buffer();

    if (Buffer.isBuffer(resolved)) {
      buffer = resolved;
    }
  }

  if (!buffer) {
    throw new Error(
      `Unable to read uploaded file '${uploaded.filename ?? fieldname}'.`,
    );
  }

  const originalname =
    uploaded.originalname ?? uploaded.filename ?? `${fieldname}-upload`;

  return {
    fieldname,
    originalname,
    encoding: uploaded.encoding ?? "7bit",
    mimetype: uploaded.mimetype ?? "application/octet-stream",
    buffer,
    size: uploaded.size ?? buffer.length,
  };
}

async function uploadOneFile(
  uploaded: RuntimeUploadedFile,
  fieldname: string,
  folderName: string,
): Promise<UploadResult> {
  const typeFile = await toTypeFile(uploaded, fieldname);
  const result = await cloudUploader(typeFile, folderName);

  if (!result) {
    throw new Error(`Cloudinary upload failed for '${typeFile.originalname}'.`);
  }

  return result;
}

async function uploadWithConcurrency(
  jobs: Array<() => Promise<UploadResult>>,
  concurrency: number,
): Promise<PromiseSettledResult<UploadResult>[]> {
  if (jobs.length === 0) {
    return [];
  }

  const results: PromiseSettledResult<UploadResult>[] = new Array(jobs.length);

  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (true) {
      const currentIndex = nextIndex++;

      if (currentIndex >= jobs.length) {
        return;
      }

      try {
        results[currentIndex] = {
          status: "fulfilled",
          value: await jobs[currentIndex](),
        };
      } catch (reason) {
        results[currentIndex] = {
          status: "rejected",
          reason,
        };
      }
    }
  }

  const workerCount = Math.min(Math.max(1, concurrency), jobs.length);

  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return results;
}

function getFileByIndex(
  files: FileMap,
  fieldName: DocumentFieldName,
  fileIndex: number,
): RuntimeUploadedFile {
  const entries = getFileEntries(files, fieldName);

  const file = entries[fileIndex];

  if (!file) {
    throw new Error(
      `Uploaded file at index ${fileIndex} was not found in '${fieldName}'.`,
    );
  }

  return file;
}

function getUploadByReference(
  references: UploadReference[],
  uploads: UploadResult[],
): Map<string, UploadResult> {
  const result = new Map<string, UploadResult>();

  references.forEach((reference, index) => {
    result.set(uploadReferenceKey(reference), uploads[index]);
  });

  return result;
}

function transformFileReferences(
  body: {
    certifications?: {
      priority: number;
      sectionTitle?: string;
      certificates: Record<
        string,
        {
          priority: number;
          overview?: string;
          skillLearned: string[];
          certificateUrl?: string;
          certificateContent?: FileReference;
          duration: string;
        }
      >;
    };
    publications?: {
      priority: number;
      sectionTitle?: string;
      publications: Record<
        string,
        {
          priority: number;
          description?: string;
          referenceUrl?: string;
          publicationReference?: FileReference[];
        }
      >;
    };
    awardsAndAchievements?: {
      priority: number;
      sectionTitle?: string;
      achievements: Array<{
        priority: number;
        title?: string;
        description?: string;
        url?: string;
        documents?: FileReference[];
      }>;
    };
  },
  uploadedFiles: Map<string, UploadResult>,
) {
  const certifications = body.certifications
    ? {
        ...body.certifications,
        certificates: Object.fromEntries(
          Object.entries(body.certifications.certificates).map(
            ([certificateName, certificate]) => {
              const reference = certificate.certificateContent;
              const upload = reference
                ? uploadedFiles.get(
                    uploadReferenceKey({
                      ...reference,
                      fieldName: "certificateFiles",
                    }),
                  )
                : undefined;

              if (reference && !upload) {
                throw new Error(
                  `Cloudinary upload result not found for certificateFiles[${reference.fileIndex}].`,
                );
              }

              return [
                certificateName,
                {
                  ...certificate,
                  certificateContent: reference
                    ? {
                        title: reference.title,
                        url: upload!.accessUrl,
                        key: upload!.publicId,
                      }
                    : undefined,
                },
              ];
            },
          ),
        ),
      }
    : undefined;

  const publications = body.publications
    ? {
        ...body.publications,
        publications: Object.fromEntries(
          Object.entries(body.publications.publications).map(
            ([publicationName, publication]) => [
              publicationName,
              {
                ...publication,
                publicationReference: publication.publicationReference?.map(
                  (reference) => {
                    const upload = uploadedFiles.get(
                      uploadReferenceKey({
                        ...reference,
                        fieldName: "publicationFiles",
                      }),
                    );

                    if (!upload) {
                      throw new Error(
                        `Cloudinary upload result not found for publicationFiles[${reference.fileIndex}].`,
                      );
                    }

                    return {
                      title: reference.title,
                      accessUrl: {
                        url: upload.accessUrl,
                        key: upload.publicId,
                      },
                    };
                  },
                ),
              },
            ],
          ),
        ),
      }
    : undefined;

  const awardsAndAchievements = body.awardsAndAchievements
    ? {
        ...body.awardsAndAchievements,
        achievements: body.awardsAndAchievements.achievements.map(
          (achievement) => ({
            ...achievement,
            documents: achievement.documents?.map((reference) => {
              const upload = uploadedFiles.get(
                uploadReferenceKey({
                  ...reference,
                  fieldName: "achievementFiles",
                }),
              );

              if (!upload) {
                throw new Error(
                  `Cloudinary upload result not found for achievementFiles[${reference.fileIndex}].`,
                );
              }

              return {
                title: reference.title,
                accessUrl: {
                  url: upload.accessUrl,
                  key: upload.publicId,
                },
              };
            }),
          }),
        ),
      }
    : undefined;

  return {
    certifications,
    publications,
    awardsAndAchievements,
  };
}

const addResumeInfoController: IController<typeof ResumeInfoSchema> = async (
  ctx,
) => {
  const body = ctx.body;
  const fileMap = getFileMap(ctx.files);

  const references = collectFileReferences({
    certifications: body.certifications,
    publications: body.publications,
    awardsAndAchievements: body.awardsAndAchievements,
  });

  const duplicateFileIndexError = validateUniqueFileIndexes(references);

  if (duplicateFileIndexError) {
    return ctx.status(400).json({
      error: duplicateFileIndexError,
    });
  }

  // Verify every body reference points at an uploaded item in its fixed field.
  for (const reference of references) {
    const entries = getFileEntries(fileMap, reference.fieldName);
    if (!entries[reference.fileIndex]) {
      return ctx.status(400).json({
        error: `Uploaded file at index ${reference.fileIndex} was not found in '${reference.fieldName}'.`,
      });
    }
  }

  // Every uploaded document must be referenced exactly once by its field/index.
  for (const fieldName of [
    "certificateFiles",
    "publicationFiles",
    "achievementFiles",
  ] as const) {
    const entries = getFileEntries(fileMap, fieldName);
    for (let fileIndex = 0; fileIndex < entries.length; fileIndex += 1) {
      if (
        !references.some(
          (reference) =>
            reference.fieldName === fieldName &&
            reference.fileIndex === fileIndex,
        )
      ) {
        return ctx.status(400).json({
          error: `Uploaded file '${fieldName}[${fileIndex}]' is not referenced by the request body.`,
        });
      }
    }
  }

  const avatarEntries = getFileEntries(fileMap, "avatar");

  if (avatarEntries.length > 1) {
    return ctx.status(400).json({
      error: "Only one avatar file may be uploaded.",
    });
  }

  const uniqueReferences = Array.from(
    new Map(
      references.map((reference) => [uploadReferenceKey(reference), reference]),
    ).values(),
  );

  const folderName = `resumes/${randomUUID()}`;

  const uploadJobs = uniqueReferences.map((reference) => {
    const uploadedFile = getFileByIndex(
      fileMap,
      reference.fieldName,
      reference.fileIndex,
    );

    return () =>
      uploadOneFile(
        uploadedFile,
        `${reference.fieldName}-${reference.fileIndex}`,
        folderName,
      );
  });

  const dynamicResults = await uploadWithConcurrency(
    uploadJobs,
    UPLOAD_CONCURRENCY,
  );

  const dynamicUploads = dynamicResults
    .filter(
      (result): result is PromiseFulfilledResult<UploadResult> =>
        result.status === "fulfilled",
    )
    .map((result) => result.value);

  const failedDynamicUpload = dynamicResults.find(
    (result) => result.status === "rejected",
  );

  let avatarUpload: UploadResult | undefined;

  if (!failedDynamicUpload && avatarEntries.length === 1) {
    try {
      avatarUpload = await uploadOneFile(
        avatarEntries[0],
        "avatar",
        folderName,
      );
    } catch (error: unknown) {
      if (dynamicUploads.length > 0) {
        await cloudDestroyerMany(
          dynamicUploads.map((upload) => upload.publicId),
        );
      }

      return ctx.status(502).json({
        error: "Avatar upload failed.",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (failedDynamicUpload) {
    const uploadedPublicIds = dynamicUploads.map((upload) => upload.publicId);

    if (uploadedPublicIds.length > 0) {
      await cloudDestroyerMany(uploadedPublicIds);
    }

    return ctx.status(502).json({
      error: "One or more files failed to upload to Cloudinary.",
      details:
        failedDynamicUpload.reason instanceof Error
          ? failedDynamicUpload.reason.message
          : String(failedDynamicUpload.reason),
    });
  }

  const dynamicUploadMap = getUploadByReference(
    uniqueReferences,
    dynamicUploads,
  );

  try {
    const transformedFileReferences = transformFileReferences(
      {
        certifications: body.certifications,
        publications: body.publications,
        awardsAndAchievements: body.awardsAndAchievements,
      },
      dynamicUploadMap,
    );

    const mongooseMaps = prepareMongooseMaps({
      educations: body.educations,
      workExperience: body.workExperience,
      skills: body.skills,
      projects: body.projects,
      certifications: body.certifications,
      openSource: body.openSource,
      publications: body.publications,
    });

    const databasePayload = {
      templateName: body.templateName || "clean-ats-optimizer",
      basicInfo: body.basicInfo,
      address: body.address,
      contactInfo: body.contactInfo,
      profileSummary: body.profileSummary,

      educations: mongooseMaps.educations,

      workExperience: mongooseMaps.workExperience,

      skills: mongooseMaps.skills,

      languageProficiency: body.languageProficiency,

      hobbies: body.hobbies,

      projects: mongooseMaps.projects,

      certifications: transformedFileReferences.certifications
        ? {
            ...transformedFileReferences.certifications,
            certificates: toMap(
              transformedFileReferences.certifications.certificates,
            ),
          }
        : undefined,

      openSource: mongooseMaps.openSource,

      publications: transformedFileReferences.publications
        ? {
            ...transformedFileReferences.publications,
            publications: toMap(
              transformedFileReferences.publications.publications,
            ),
          }
        : undefined,

      awardsAndAchievements: transformedFileReferences.awardsAndAchievements,

      avatar: avatarUpload
        ? {
            url: avatarUpload.accessUrl,
            key: avatarUpload.publicId,
          }
        : undefined,


    };

    const resume = await Resume.create(databasePayload);

    return ctx.status(201).json({
      status: "success",
      message: "Resume created successfully.",
      data: resume,
    });
  } catch (error: unknown) {
    const uploadedPublicIds = [
      ...dynamicUploads.map((upload) => upload.publicId),
      ...(avatarUpload ? [avatarUpload.publicId] : []),
    ];

    if (uploadedPublicIds.length > 0) {
      await cloudDestroyerMany(uploadedPublicIds);
    }

    return ctx.status(500).json({
      error: "Failed to persist resume data.",
      details: error instanceof Error ? error.message : String(error),
    });
  }
};

export default addResumeInfoController;
