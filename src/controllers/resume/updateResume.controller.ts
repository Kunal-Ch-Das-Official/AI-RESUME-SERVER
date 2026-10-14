/* eslint-disable @typescript-eslint/no-explicit-any */
import mongoose from "mongoose";
import { uuid, type IController } from "subatom";
import {
  TypeFile,
  UploadResult,
} from "../../middlewares/blob-operations/fileUploader.types.js";
import cloudUploader from "../../middlewares/blob-operations/cloudUploader.js";
import cloudDestroyer from "../../middlewares/blob-operations/cloudDestroyer.js";
import { ResumePatchSchema } from "../../schema/patch.resume.schema.js";
import { Resume } from "../../models/resumeInfo.js";

interface FileReferencePatch {
  fileIndex?: number;
  key?: string;
  title?: string;
  remove?: boolean;
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

type DocumentFieldName =
  | "certificateFiles"
  | "publicationFiles"
  | "achievementFiles";

const MAX_CLOUDINARY_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

function getOneUploadedFile(
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
    const result = await uploaded.buffer();

    if (Buffer.isBuffer(result)) {
      buffer = result;
    }
  }

  if (!buffer) {
    throw new Error(
      `Unable to read uploaded file '${uploaded.filename ?? fieldname}'.`,
    );
  }

  return {
    fieldname,
    originalname:
      uploaded.originalname ?? uploaded.filename ?? `${fieldname}-upload`,
    encoding: uploaded.encoding ?? "7bit",
    mimetype: uploaded.mimetype ?? "application/octet-stream",
    buffer,
    size: uploaded.size ?? buffer.length,
  };
}

async function uploadWithRetry(
  uploaded: RuntimeUploadedFile,
  fieldname: string,
  folderName: string,
): Promise<UploadResult> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_CLOUDINARY_RETRIES; attempt++) {
    try {
      const file = await toTypeFile(uploaded, fieldname);
      const result = await cloudUploader(file, folderName);

      if (result) {
        return result;
      }

      throw new Error("Cloudinary uploader returned null.");
    } catch (error: unknown) {
      lastError = error;

      if (attempt < MAX_CLOUDINARY_RETRIES) {
        await sleep(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Upload failed for '${fieldname}'.`);
}

async function destroyWithRetry(publicId: string): Promise<boolean> {
  for (let attempt = 1; attempt <= MAX_CLOUDINARY_RETRIES; attempt++) {
    try {
      const result = await cloudDestroyer(publicId);

      if (result === true) {
        return true;
      }
    } catch {
      // Retry below.
    }

    if (attempt < MAX_CLOUDINARY_RETRIES) {
      await sleep(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
    }
  }

  return false;
}

async function cleanupCloudinaryFiles(publicIds: string[]): Promise<string[]> {
  const uniqueIds = [...new Set(publicIds.filter((value) => value.length > 0))];

  const failed: string[] = [];

  for (const publicId of uniqueIds) {
    const deleted = await destroyWithRetry(publicId);

    if (!deleted) {
      failed.push(publicId);
    }
  }

  return failed;
}

function removeControlFields<T extends Record<string, unknown>>(
  value: T,
): Partial<T> {
  const result = { ...value };

  delete result.remove;
  delete result.fileIndex;
  delete result.key;

  return result;
}

function mergeObject<T extends Record<string, any>>(
  current: T | undefined,
  patch: Partial<T>,
): T {
  return {
    ...(current ?? ({} as T)),
    ...patch,
  };
}

function isPlainObject(value: unknown): value is Record<string, any> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    !(value instanceof Date)
  );
}

function safeObjectId(value: string): boolean {
  return mongoose.isValidObjectId(value);
}

/**
 * Apply a dynamic-key patch to a plain object.
 *
 * `{ companyA: { jobTitle: "..." } }`
 * updates only companyA and leaves other companies intact.
 *
 * `{ companyA: { remove: true } }`
 * removes companyA.
 */
function assertSafeMongoKey(key: string): void {
  if (key.length === 0) {
    throw new Error("Dynamic map keys cannot be empty.");
  }

  if (key.includes(".") || key.startsWith("$")) {
    throw new Error(
      `Unsafe MongoDB dynamic key '${key}'. Keys cannot contain '.' or start with '$'.`,
    );
  }
}

function patchDynamicMap(
  current: Record<string, any> | undefined,
  patch: Record<string, any>,
): Record<string, any> {
  const result = {
    ...(current ?? {}),
  };

  for (const [key, value] of Object.entries(patch)) {
    assertSafeMongoKey(key);

    if (!isPlainObject(value)) {
      result[key] = value;
      continue;
    }

    if (value.remove === true) {
      delete result[key];
      continue;
    }

    const existing = isPlainObject(result[key]) ? result[key] : {};

    result[key] = {
      ...existing,
      ...removeControlFields(value),
    };
  }

  return result;
}

function findReferenceIndex(
  references: Array<Record<string, any>>,
  patch: FileReferencePatch,
): number {
  const patchKey = typeof patch.key === "string" ? patch.key.trim() : undefined;

  /*
   * 1. Explicit Cloudinary key is the strongest identity.
   */
  if (patchKey) {
    const exactIndex = references.findIndex((reference) => {
      const existingKey =
        typeof reference?.accessUrl?.key === "string"
          ? reference.accessUrl.key.trim()
          : undefined;

      return existingKey === patchKey;
    });

    if (exactIndex >= 0) {
      return exactIndex;
    }

    /*
     * IMPORTANT:
     * A supplied key means the caller intends to operate
     * on an existing document.
     *
     * Do NOT fall through and treat this as a new document.
     */
    throw new Error(
      `Existing document with key '${patchKey}' was not found. ` +
        `Verify that the key matches the current resume data.`,
    );
  }

  /*
   * 2. If no key is supplied, allow unique title matching.
   */
  if (typeof patch.title === "string" && patch.title.trim()) {
    const title = patch.title.trim();

    const matches = references.reduce<number[]>((indexes, reference, index) => {
      if (
        typeof reference?.title === "string" &&
        reference.title.trim() === title
      ) {
        indexes.push(index);
      }

      return indexes;
    }, []);

    if (matches.length === 1) {
      return matches[0];
    }

    if (matches.length > 1) {
      throw new Error(
        `Multiple existing documents have the title '${title}'. ` +
          `Provide the existing Cloudinary public_id in 'key'.`,
      );
    }
  }

  /*
   * 3. No key and no unique title match means this is
   *    a genuinely new document.
   */
  return -1;
}

async function applyFileReferencePatch(
  current: Record<string, any> | undefined,
  patch: FileReferencePatch,
  files: FileMap,
  fieldName: DocumentFieldName,
  folderName: string,
  oldKeysToDelete: Set<string>,
  newlyUploadedKeys: string[],
): Promise<Record<string, string> | undefined> {
  const existing = current ? { ...current } : undefined;

  if (patch.remove === true) {
    if (existing?.key) {
      oldKeysToDelete.add(existing.key);
    }

    return undefined;
  }

  const hasNewFile = typeof patch.fileIndex === "number";

  if (hasNewFile) {
    const uploaded = await uploadWithRetry(
      getOneUploadedFile(files, fieldName, patch.fileIndex!),
      `${fieldName}-${patch.fileIndex}`,
      folderName,
    );

    newlyUploadedKeys.push(uploaded.publicId);

    if (existing?.key && existing.key !== uploaded.publicId) {
      oldKeysToDelete.add(existing.key);
    }

    return {
      title: patch.title ?? existing?.title ?? "Document",
      url: uploaded.accessUrl,
      key: uploaded.publicId,
    };
  }

  if (!existing) {
    if (patch.key) {
      throw new Error(
        `Existing file with Cloudinary public_id '${patch.key}' was not found in this resume. Use the key currently stored in the resume document, or omit 'key' when creating a new document.`,
      );
    }

    return undefined;
  }

  if (patch.key && patch.key !== existing.key) {
    throw new Error(
      `File key '${patch.key}' does not match the existing document.`,
    );
  }

  return {
    ...existing,
    ...(patch.title !== undefined ? { title: patch.title } : {}),
  };
}

async function applyFileReferenceArrayPatch(
  current: Array<Record<string, any>> | undefined,
  patches: FileReferencePatch[] | undefined,
  files: FileMap,
  fieldName: DocumentFieldName,
  folderName: string,
  oldKeysToDelete: Set<string>,
  newlyUploadedKeys: string[],
): Promise<Array<Record<string, any>> | undefined> {
  if (patches === undefined) {
    return current;
  }

  const result = [...(current ?? [])];

  for (const patch of patches) {
    const existingIndex = findReferenceIndex(result, patch);

    if (existingIndex >= 0) {
      if (patch.remove === true) {
        const [removed] = result.splice(existingIndex, 1);

        if (removed?.accessUrl?.key) {
          oldKeysToDelete.add(removed.accessUrl.key);
        }

        continue;
      }

      const existing = result[existingIndex];

      if (patch.fileIndex !== undefined) {
        const uploaded = await uploadWithRetry(
          getOneUploadedFile(files, fieldName, patch.fileIndex),
          `${fieldName}-${patch.fileIndex}`,
          folderName,
        );

        newlyUploadedKeys.push(uploaded.publicId);

        if (
          existing?.accessUrl?.key &&
          existing.accessUrl.key !== uploaded.publicId
        ) {
          oldKeysToDelete.add(existing.accessUrl.key);
        }

        result[existingIndex] = {
          title: patch.title ?? existing?.title ?? "Document",
          accessUrl: {
            url: uploaded.accessUrl,
            key: uploaded.publicId,
          },
        };
      } else {
        result[existingIndex] = {
          ...existing,
          ...(patch.title !== undefined ? { title: patch.title } : {}),
        };
      }

      continue;
    }

    if (patch.remove === true) {
      // A removal request without an identifiable existing reference is a
      // no-op rather than a destructive guess.
      continue;
    }

    if (patch.fileIndex === undefined) {
      throw new Error("A new document must provide a fileIndex.");
    }

    const uploaded = await uploadWithRetry(
      getOneUploadedFile(files, fieldName, patch.fileIndex),
      `${fieldName}-${patch.fileIndex}`,
      folderName,
    );

    newlyUploadedKeys.push(uploaded.publicId);

    result.push({
      title: patch.title ?? "Document",
      accessUrl: {
        url: uploaded.accessUrl,
        key: uploaded.publicId,
      },
    });
  }

  return result;
}

function getPlainResume(resume: mongoose.Document): Record<string, any> {
  return resume.toObject({
    flattenMaps: true,
    depopulate: true,
    virtuals: false,
  }) as Record<string, any>;
}

function cloneValue<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

function isEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) {
    return true;
  }

  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }

  if (!isPlainObject(a) || !isPlainObject(b)) {
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) {
        return false;
      }

      return a.every((item, index) => isEqual(item, b[index]));
    }

    return false;
  }

  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);

  if (aKeys.length !== bKeys.length) {
    return false;
  }

  return aKeys.every(
    (key) =>
      Object.prototype.hasOwnProperty.call(b, key) && isEqual(a[key], b[key]),
  );
}

const IGNORED_DIFF_KEYS = new Set(["_id", "__v", "createdAt", "updatedAt"]);

function buildChanges(
  current: any,
  next: any,
  path: string,
  sets: Record<string, unknown>,
  unsets: Set<string>,
): void {
  if (isEqual(current, next)) {
    return;
  }

  if (isPlainObject(current) && isPlainObject(next)) {
    const keys = new Set([...Object.keys(current), ...Object.keys(next)]);

    for (const key of keys) {
      if (IGNORED_DIFF_KEYS.has(key)) {
        continue;
      }

      const childPath = path ? `${path}.${key}` : key;

      if (!Object.prototype.hasOwnProperty.call(next, key)) {
        unsets.add(childPath);
        continue;
      }

      if (!Object.prototype.hasOwnProperty.call(current, key)) {
        sets[childPath] = next[key];
        continue;
      }

      buildChanges(current[key], next[key], childPath, sets, unsets);
    }

    return;
  }

  if (next === undefined) {
    unsets.add(path);
  } else {
    sets[path] = next;
  }
}

function removeUndefinedProperties(value: unknown): unknown {
  if (!isPlainObject(value) && !Array.isArray(value)) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(removeUndefinedProperties);
  }

  const output: Record<string, unknown> = {};

  for (const [key, item] of Object.entries(value)) {
    if (item !== undefined) {
      output[key] = removeUndefinedProperties(item);
    }
  }

  return output;
}

const updateResumeController: IController<typeof ResumePatchSchema> = async (
  ctx,
) => {
  const resumeId = String(ctx.params?.resumeId ?? "");

  if (!safeObjectId(resumeId)) {
    return ctx.status(400).json({
      error: "Invalid resume id.",
    });
  }

  const resume = await Resume.findById(resumeId);

  if (!resume) {
    return ctx.status(404).json({
      error: "Resume not found.",
    });
  }

  const body = ctx.body as any;
  const files = getFileMap(ctx.files);

  const original = getPlainResume(resume);
  const target = cloneValue(original);

  const folderName = `resumes/${resumeId}/updates/${uuid()}`;
  const oldKeysToDelete = new Set<string>();
  const newlyUploadedKeys: string[] = [];

  try {
    if (body.basicInfo) {
      target.basicInfo = mergeObject(target.basicInfo, body.basicInfo);
    }

    if (body.address) {
      target.address = mergeObject(target.address, body.address);
    }

    if (body.contactInfo) {
      target.contactInfo = mergeObject(target.contactInfo, body.contactInfo);
    }

    if (body.profileSummary) {
      target.profileSummary = mergeObject(
        target.profileSummary,
        body.profileSummary,
      );
    }

    for (const dynamicSection of [
      body.educations?.qualifications,
      body.workExperience?.companies,
      body.skills?.skills,
      body.projects?.projects,
      body.certifications?.certificates,
      body.openSource?.contributions,
      body.publications?.publications,
    ]) {
      if (dynamicSection) {
        for (const key of Object.keys(dynamicSection)) {
          assertSafeMongoKey(key);
        }
      }
    }

    if (body.educations) {
      target.educations = mergeObject(target.educations, {
        ...body.educations,
        qualifications:
          body.educations.qualifications !== undefined
            ? patchDynamicMap(
                target.educations?.qualifications,
                body.educations.qualifications,
              )
            : target.educations?.qualifications,
      });
    }

    if (body.workExperience) {
      target.workExperience = mergeObject(target.workExperience, {
        ...body.workExperience,
        companies:
          body.workExperience.companies !== undefined
            ? patchDynamicMap(
                target.workExperience?.companies,
                body.workExperience.companies,
              )
            : target.workExperience?.companies,
      });
    }

    if (body.skills) {
      target.skills = mergeObject(target.skills, {
        ...body.skills,
        skills:
          body.skills.skills !== undefined
            ? {
                ...(target.skills?.skills ?? {}),
                ...body.skills.skills,
              }
            : target.skills?.skills,
      });
    }

    if (body.languageProficiency) {
      target.languageProficiency = mergeObject(
        target.languageProficiency,
        body.languageProficiency,
      );
    }

    if (body.hobbies) {
      target.hobbies = mergeObject(target.hobbies, body.hobbies);
    }

    if (body.projects) {
      target.projects = mergeObject(target.projects, {
        ...body.projects,
        projects:
          body.projects.projects !== undefined
            ? patchDynamicMap(target.projects?.projects, body.projects.projects)
            : target.projects?.projects,
      });
    }

    if (body.openSource) {
      target.openSource = mergeObject(target.openSource, {
        ...body.openSource,
        contributions:
          body.openSource.contributions !== undefined
            ? patchDynamicMap(
                target.openSource?.contributions,
                body.openSource.contributions,
              )
            : target.openSource?.contributions,
      });
    }

    if (body.templateName !== undefined) {
      target.templateName = body.templateName;
    }

    if (body.certifications) {
      target.certifications = mergeObject(target.certifications, {
        ...body.certifications,
        certificates:
          body.certifications.certificates !== undefined
            ? {
                ...(target.certifications?.certificates ?? {}),
              }
            : target.certifications?.certificates,
      });

      if (body.certifications.certificates) {
        for (const [certificateName, patch] of Object.entries(
          body.certifications.certificates,
        ) as Array<[string, any]>) {
          const currentCertificate =
            target.certifications?.certificates?.[certificateName];

          if (patch.remove === true) {
            delete target.certifications.certificates[certificateName];
            continue;
          }

          const nextCertificate = {
            ...(currentCertificate ?? {}),
            ...removeControlFields(patch),
          };

          if (patch.certificateContent !== undefined) {
            nextCertificate.certificateContent = await applyFileReferencePatch(
              currentCertificate?.certificateContent,
              patch.certificateContent,
              files,
              "certificateFiles",
              folderName,
              oldKeysToDelete,
              newlyUploadedKeys,
            );
          }

          target.certifications.certificates[certificateName] = nextCertificate;
        }
      }
    }

    if (body.publications) {
      target.publications = mergeObject(target.publications, {
        ...body.publications,
        publications:
          body.publications.publications !== undefined
            ? {
                ...(target.publications?.publications ?? {}),
              }
            : target.publications?.publications,
      });

      if (body.publications.publications) {
        for (const [publicationName, patch] of Object.entries(
          body.publications.publications,
        ) as Array<[string, any]>) {
          const currentPublication =
            target.publications?.publications?.[publicationName];

          if (!currentPublication && patch.remove === true) {
            continue;
          }

          if (patch.remove === true) {
            delete target.publications.publications[publicationName];
            continue;
          }

          const nextPublication = {
            ...(currentPublication ?? {}),
            ...removeControlFields(patch),
          };

          if (patch.publicationReference !== undefined) {
            nextPublication.publicationReference =
              await applyFileReferenceArrayPatch(
                currentPublication?.publicationReference,
                patch.publicationReference,
                files,
                "publicationFiles",
                folderName,
                oldKeysToDelete,
                newlyUploadedKeys,
              );
          }

          target.publications.publications[publicationName] = nextPublication;
        }
      }
    }

    if (body.awardsAndAchievements) {
      target.awardsAndAchievements = mergeObject(target.awardsAndAchievements, {
        ...body.awardsAndAchievements,
      });

      if (body.awardsAndAchievements.achievements !== undefined) {
        const existingAchievements =
          target.awardsAndAchievements?.achievements ?? [];

        const nextAchievements = [];

        for (const patch of body.awardsAndAchievements.achievements as any[]) {
          const base =
            typeof patch.priority === "number"
              ? existingAchievements.find(
                  (item: any) => item.priority === patch.priority,
                )
              : undefined;

          const nextAchievement = {
            ...(base ?? {}),
            ...removeControlFields(patch),
          };

          if (patch.documents !== undefined) {
            nextAchievement.documents = await applyFileReferenceArrayPatch(
              base?.documents,
              patch.documents,
              files,
              "achievementFiles",
              folderName,
              oldKeysToDelete,
              newlyUploadedKeys,
            );
          }

          nextAchievements.push(nextAchievement);
        }

        target.awardsAndAchievements.achievements = nextAchievements;
      }
    }

    // Avatar replacement/removal.
    const avatarUploadEntries = getFileEntries(files, "avatar");

    if (avatarUploadEntries.length > 1) {
      return ctx.status(400).json({
        error: "Only one avatar file may be uploaded.",
      });
    }

    if (avatarUploadEntries.length === 1) {
      const uploadedAvatar = await uploadWithRetry(
        avatarUploadEntries[0],
        "avatar",
        folderName,
      );

      newlyUploadedKeys.push(uploadedAvatar.publicId);

      if (target.avatar?.key) {
        oldKeysToDelete.add(target.avatar.key);
      }

      target.avatar = {
        url: uploadedAvatar.accessUrl,
        key: uploadedAvatar.publicId,
      };
    } else if (body.avatar?.remove === true) {
      if (target.avatar?.key) {
        oldKeysToDelete.add(target.avatar.key);
      }

      target.avatar = undefined;
    }

    const cleanedTarget = removeUndefinedProperties(target) as Record<
      string,
      any
    >;

    const originalForDiff = removeUndefinedProperties(original);

    const sets: Record<string, unknown> = {};
    const unsets = new Set<string>();

    buildChanges(originalForDiff, cleanedTarget, "", sets, unsets);

    // Never allow internal Mongo/Mongoose metadata to be changed.
    for (const key of Object.keys(sets)) {
      if (
        key === "_id" ||
        key === "__v" ||
        key === "createdAt" ||
        key === "updatedAt" ||
        key.startsWith("_id.")
      ) {
        delete sets[key];
      }
    }

    for (const key of [...unsets]) {
      if (
        key === "_id" ||
        key === "__v" ||
        key === "createdAt" ||
        key === "updatedAt" ||
        key.startsWith("_id.")
      ) {
        unsets.delete(key);
      }
    }

    if (Object.keys(sets).length === 0 && unsets.size === 0) {
      return ctx.status(200).json({
        status: "success",
        message: "No changes detected.",
        data: resume,
      });
    }

    for (const [path, value] of Object.entries(sets)) {
      resume.set(path, value);
    }

    for (const path of unsets) {
      resume.set(path, undefined);
    }

    // Mongoose optimisticConcurrency must be enabled on the model schema.
    await resume.save();

    // DB now safely points to the new Cloudinary resources.
    // Delete old resources afterward. A deletion failure does not invalidate
    // the already-committed database update; it is reported as a cleanup warning.
    const cleanupFailures = await cleanupCloudinaryFiles(
      [...oldKeysToDelete].filter((key) => !newlyUploadedKeys.includes(key)),
    );

    const response: Record<string, unknown> = {
      status: "success",
      message: "Resume updated successfully.",
      data: resume,
    };

    if (cleanupFailures.length > 0) {
      response.cleanupWarnings = cleanupFailures.map((key) => ({
        key,
        message:
          "Previous Cloudinary resource could not be removed after 3 attempts.",
      }));
    }

    return ctx.status(200).json(response);
  } catch (error: unknown) {
    // If DB save failed, remove every newly uploaded resource so that
    // Cloudinary and MongoDB remain consistent.
    const cleanupFailures = await cleanupCloudinaryFiles([
      ...new Set(newlyUploadedKeys),
    ]);

    return ctx.status(500).json({
      error: "Failed to update resume.",
      details: error instanceof Error ? error.message : String(error),
      rollbackWarnings:
        cleanupFailures.length > 0 ? cleanupFailures : undefined,
    });
  }
};

export default updateResumeController;
