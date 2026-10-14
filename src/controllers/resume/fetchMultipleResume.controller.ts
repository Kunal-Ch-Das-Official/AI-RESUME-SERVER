import { IController } from "subatom";
import { MultipleResumeIdSchema } from "../../schema/resume.schema.js";
import { Resume } from "../../models/resumeInfo.js";

const fetchMultipleResumeController: IController<
  typeof MultipleResumeIdSchema
> = async (ctx) => {
  const { ids } = ctx.query;

  try {
    if (!Array.isArray(ids) || ids.length === 0) {
      return ctx.helper.bad_request("An array of resume IDs is required.");
    }

    const resumes = await Resume.find({
      _id: { $in: ids },
    });

    return ctx.response.status(200).json(resumes);
  } catch (error: unknown) {
    return ctx.helper.internal_server_error((error as Error).message);
  }
};

export default fetchMultipleResumeController;
