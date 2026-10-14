import { IController } from "subatom";
import { myResumeSchema } from "../../../schema/auth.schema.js";
import UserModel from "../../../models/usersData.js";
import mongoose from "mongoose";

const addNewResumeController: IController<typeof myResumeSchema> = async (
  ctx,
) => {
  console.log("🔥 HIT: /api/v1/auth/add-resume-id endpoint called!");
  console.log("📥 Raw Request Body:", ctx.body);

  const { resumeInfoId, userId } = ctx.body || {};

  if (!resumeInfoId || !userId) {
    console.error(
      "❌ Missing fields -> resumeInfoId:",
      resumeInfoId,
      "userId:",
      userId,
    );
    return ctx.helper.bad_request("resumeInfoId and userId are required.");
  }

  try {
    // Ensure userId is treated as an ObjectId if needed
    const objectIdUser = mongoose.isValidObjectId(userId)
      ? new mongoose.Types.ObjectId(userId)
      : userId;

    console.log("🔍 Searching and updating user with ID:", objectIdUser);

    const updatedUser = await UserModel.findByIdAndUpdate(
      objectIdUser,
      {
        $push: {
          myResume: resumeInfoId,
        },
      },
      { new: true },
    );

    console.log("📄 Updated User Document Result:", updatedUser);

    if (!updatedUser) {
      console.error("❌ User not found in database for ID:", userId);
      return ctx.helper.not_found("User not found.");
    }

    return ctx.helper.success({
      message: "Resume ID added successfully",
      data: updatedUser,
    });
  } catch (error: unknown) {
    console.error("💥 Mongoose Update Exception:", error);
    return ctx.helper.internal_server_error((error as Error).message);
  }
};

export default addNewResumeController;
