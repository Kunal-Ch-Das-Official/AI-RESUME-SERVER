
import { IController, hash } from "subatom";

import UserModel from "../../models/usersData.js";
import { passwordUpdateSchema } from "../../schema/auth.schema.js";

const updatePasswordController: IController<
  typeof passwordUpdateSchema
> = async (ctx) => {
  const { currentPassword, newPassword } = ctx.body;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentUser = ctx.user as any;

  if (!currentUser) {
    return ctx.helper.unauthorized(
      "Please sign-up or login first to update password.",
    );
  }

  const user = await UserModel.findById(currentUser.id);

  if (!user) {
    return ctx.helper.unauthorized("User account not found.");
  }

  // Verify using the same key length used when the existing password was hashed.
  const isCurrentPasswordValid = hash.verify(
    currentPassword,
    user.password,
    32,
  );

  if (!isCurrentPasswordValid) {
    return ctx.helper.bad_request("Current password is incorrect.");
  }

  user.password = hash.password(newPassword, { keylen: 32 });
  await user.save();

  return ctx.helper.success("Password successfully updated.");
};

export default updatePasswordController;
