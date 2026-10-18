import infer from "subatom-infer";

export const trackAiFeatureSchema = {
  body: {
    userId: infer.string().min(1),
    resumeId: infer.string().min(1),
    featureKey: infer.string(),
  },
};

export const getAiUsageParamSchema = {
  params: {
    resumeId: infer.string().min(1),
  },
  query: {
    userId: infer.string().min(1),
  },
};

export const finalizeResumeAiSchema = {
  body: {
    userId: infer.string().min(1),
    resumeId: infer.string().min(1),
    draftId: infer.string().optional(),
  },
};