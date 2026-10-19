import { IController } from "subatom";
import { myResumeSchema } from "../../../schema/auth.schema.js";
import UserModel from "../../../models/usersData.js";

const addNewResumeController: IController<typeof myResumeSchema> = async (
  ctx,
) => {
  const { resumeInfoId, userId } = ctx.body;

  const user = await UserModel.findById(userId);

  if (!user) {
    return ctx.helper.not_found("User not found.");
  }

  // Atomically append new resume ID
  const updatedUser = await UserModel.findByIdAndUpdate(
    userId,
    {
      $addToSet: { myResume: resumeInfoId },
    },
    { new: true },
  );

  return ctx.status(200).json({
    success: true,
    message: "Resume linked successfully.",
    resumesUsed: updatedUser?.myResume?.length || 0,
    remainingCredits: Math.max(
      0,
      (updatedUser?.resumeCredits || 0) - (updatedUser?.myResume?.length || 0),
    ),
  });
};

export default addNewResumeController;
