import mongoose from "mongoose";
import { IController } from "subatom";
import { Resume } from "../../models/resumeInfo.js";

/**
 * GET /api/v1/resume
 *
 * Fetch all resumes.
 */
export const getAllResumeController: IController = async (ctx) => {
  try {
    const resumes = await Resume.find({})
      .sort({ updatedAt: -1 })
      .lean();

    return ctx.status(200).json({
      status: "success",
      message: "Resumes fetched successfully.",
      count: resumes.length,
      data: resumes,
    });
  } catch (error: unknown) {
    console.error({
      issue: "Failed to fetch resumes.",
      issueOrigin: "getAllResumeController",
      error,
    });

    return ctx.status(500).json({
      status: "error",
      message: "Failed to fetch resumes.",
      details:
        error instanceof Error
          ? error.message
          : "Unknown database error.",
    });
  }
};

/**
 * GET /api/v1/resume/:resumeId
 *
 * Fetch a single resume by MongoDB ObjectId.
 */
export const getResumeByIdController: IController = async (ctx) => {
  try {
    const { resumeId } = ctx.params as {
      resumeId?: string;
    };

    if (!resumeId) {
      return ctx.status(400).json({
        status: "error",
        message: "Resume ID is required.",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(resumeId)) {
      return ctx.status(400).json({
        status: "error",
        message: "Invalid resume ID.",
        details: `The value '${resumeId}' is not a valid MongoDB ObjectId.`,
      });
    }

    const resume = await Resume.findById(resumeId).lean();

    if (!resume) {
      return ctx.status(404).json({
        status: "error",
        message: "Resume not found.",
        details: `No resume exists with ID '${resumeId}'.`,
      });
    }

    return ctx.status(200).json({
      status: "success",
      message: "Resume fetched successfully.",
      data: resume,
    });
  } catch (error: unknown) {
    console.error({
      issue: "Failed to fetch resume.",
      issueOrigin: "getResumeByIdController",
      error,
    });

    return ctx.status(500).json({
      status: "error",
      message: "Failed to fetch resume.",
      details:
        error instanceof Error
          ? error.message
          : "Unknown database error.",
    });
  }
};