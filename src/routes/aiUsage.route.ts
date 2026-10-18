import { type IRouter, Router } from "subatom";
import {
  trackAiFeatureSchema,
  getAiUsageParamSchema,
  finalizeResumeAiSchema,
} from "../schema/aiUsage.schema.js";
import {
  trackAiFeatureController,
  getAiUsageController,
  finalizeResumeAiController,
} from "../controllers/ai-usage/aiUsage.controller.js";

const aiUsageRouter: IRouter = new Router();

// Track an individual AI feature call instantly
aiUsageRouter.post("/resumes/track-ai", {
  name: "resumes.ai.track",
  tags: ["Resume AI Usage"],
  schema: trackAiFeatureSchema,
  controller: trackAiFeatureController,
});

// Fetch current in-flight AI usage from Redis
aiUsageRouter.get("/resumes/:resumeId/ai-usage", {
  name: "resumes.ai.get_usage",
  tags: ["Resume AI Usage"],
  schema: getAiUsageParamSchema,
  controller: getAiUsageController,
});

// Finalize on Print / PDF: Deduct 1 credit & persist into Mongo
aiUsageRouter.post("/resumes/finalize-and-deduct", {
  name: "resumes.ai.finalize",
  tags: ["Resume AI Usage"],
  schema: finalizeResumeAiSchema,
  controller: finalizeResumeAiController,
});

export default aiUsageRouter;
