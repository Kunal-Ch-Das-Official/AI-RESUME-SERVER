import { IController, hash } from "subatom";
import UserModel from "../../models/usersData.js";
import { userRegistrationSchema } from "../../schema/auth.schema.js";

const userRegistrationCtrl: IController<typeof userRegistrationSchema> = async (
  ctx,
) => {
  const { userName, emailId, fullName, age, password } = ctx.body;

  // Avatar uploaded to Cloudinary
  // Replace these values with your actual Cloudinary upload result.
  const avatar = null;

  const hashPassword = hash.password(password!, { keylen: 32 });

  const user = await UserModel.create({
    userName,
    emailId,
    fullName,
    age,
    avatar,
    password: hashPassword,
  });

  if (!user) {
    return ctx.helper.not_implemented(
      "Something went wrong, please try again later.",
    );
  }

  return ctx.helper.success({
    success: true,
    message: "User registered successfully",
    data: user,
  });
};

export default userRegistrationCtrl;
