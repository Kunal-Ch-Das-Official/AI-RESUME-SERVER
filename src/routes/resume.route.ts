import {
  file,
  type DocumentedMiddleware,
  Router,
  type IRouter,
  IRouteMiddleware,
} from "subatom";

import infer from "subatom-infer";

import { MultipleResumeIdSchema, ResumeInfoSchema } from "../schema/resume.schema.js";
import { ResumePatchSchema } from "../schema/patch.resume.schema.js";

import addResumeInfoController from "../controllers/resume/addResumeInfo.controller.js";
import updateResumeController from "../controllers/resume/updateResume.controller.js";

import {
  getAllResumeController,
  getResumeByIdController,
} from "../controllers/resume/getResume.controller.js";

import deleteResumeController from "../controllers/resume/deleteResume.controller.js";
import authorizationMiddleware from "../middlewares/authorization.middleware.js";
import fetchMultipleResumeController from "../controllers/resume/fetchMultipleResume.controller.js";

const resumeRouter: IRouter = new Router();

/**
 * Multipart upload configuration.
 *
 * `file.fields()` always returns uploaded files as arrays:
 *
 * {
 *   avatar: [UploadedFile],
 *   certificateFiles: [UploadedFile, UploadedFile],
 *   publicationFiles: [UploadedFile],
 *   achievementFiles: [UploadedFile]
 * }
 *
 * The schemas are therefore responsible for validating these values
 * as file collections.
 */
const resumeUploads = file.fields(
  [
    {
      name: "avatar",
      maxCount: 1,
    },
    {
      name: "certificateFiles",
      maxCount: 20,
    },
    {
      name: "publicationFiles",
      maxCount: 20,
    },
    {
      name: "achievementFiles",
      maxCount: 20,
    },
  ],
  {
    storage: "memory",
  },
);

/**
 * Add new resume
 *
 * POST /api/v1/resume/upload-resume
 *
 * Multipart fields:
 * - avatar
 * - certificateFiles[]
 * - publicationFiles[]
 * - achievementFiles[]
 *
 * JSON body fields are handled by ResumeInfoSchema.
 */
resumeRouter.post("/upload-resume", {
  name: "upload.resume",
  tags: ["Resume"],
  schema: ResumeInfoSchema,
  middleware: [resumeUploads as unknown as DocumentedMiddleware],
  controller: addResumeInfoController,
});

/**
 * Update existing resume
 *
 * PATCH /api/v1/resume/update-resume/:resumeId
 *
 * Uses the same multipart upload configuration as the create endpoint.
 *
 * IMPORTANT:
 * Do not manually unwrap `avatar` here.
 * `file.fields()` returns arrays and ResumePatchSchema should validate
 * the avatar using `infer.files()`.
 */
resumeRouter.patch("/update-resume/:resumeId", {
  name: "resume.update",
  tags: ["Resume"],
  schema: ResumePatchSchema,
  middleware: [resumeUploads as unknown as IRouteMiddleware],
  controller: updateResumeController,
});

/**
 * Get all resumes
 *
 * GET /api/v1/resume/fetch-resume
 */
resumeRouter.get("/fetch-resume", {
  name: "resume.getAll",
  tags: ["Resume"],
  controller: getAllResumeController,
});

/**
 * Get one resume by ID
 *
 * GET /api/v1/resume/fetch-resume/:resumeId
 */
resumeRouter.get("/fetch-resume/:resumeId", {
  name: "resume.getById",
  tags: ["Resume"],
  schema: {
    params: {
      resumeId: infer.string().optional(),
    },
  },
  controller: getResumeByIdController,
});

/**
 * Delete resume
 *
 * DELETE /api/v1/resume/resume/:resumeId
 */
resumeRouter.delete("/resume/:resumeId", {
  name: "resume.delete",
  tags: ["Resume"],
  schema: {
    params: {
      resumeId: infer.string().uuid(),
    },
  },
  middleware: [authorizationMiddleware],
  controller: deleteResumeController,
});


resumeRouter.get("/multiple-resume", {
  name: "resume.fetch.many",
  tags: ["Resume"],
  schema: MultipleResumeIdSchema,
  controller: fetchMultipleResumeController,
});



export default resumeRouter;
