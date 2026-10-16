import { IController, hash } from "subatom";
import crypto from "crypto";
import UserModel from "../../../models/usersData.js";
import { userRegistrationSchema } from "../../../schema/auth.schema.js";
import sendCredentialsEmail from "../../../emails/sendCredentialsEmail.js";
import envConfig from "../../../config/envConfig.js";

const convenientUserRegistrationCtrl: IController<
  typeof userRegistrationSchema
> = async (ctx) => {
  const { userName, emailId, fullName, age } = ctx.body;

  const isExistingUser = await UserModel.findOne({ emailId });

  if (isExistingUser) {
    return ctx.helper.unprocessable_content("User already exists");
  }

  // 1. Automatically generate a strong 32-character password on the backend
  const rawPassword = crypto.randomBytes(16).toString("hex");

  // Avatar placeholder
  const avatar = null;

  const hashPassword = hash.password(rawPassword, { keylen: 32 });

  // 2. Create the user record in MongoDB using the hashed password
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

  // 3. Attempt to send the auto-generated plaintext credentials email
  // 3. Attempt to send the auto-generated plaintext credentials email
  const mailResult = await sendCredentialsEmail(
    emailId,
    rawPassword,
    envConfig.SMTP_BUSINESS_EMAIL || "team@airesume.download",
  );

  // 4. If email fails, roll back database creation with up to 5 retry attempts
  if (!mailResult.success) {
    console.warn(
      "Email dispatch failed. Starting rollback deletion attempts...",
    );

    let isDeleted = false;
    const maxRetries = 5;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const deletedRecord = await UserModel.findByIdAndDelete(user._id);
        if (deletedRecord) {
          isDeleted = true;
          console.log(`Rollback successful on attempt ${attempt}`);
          break;
        }
      } catch (dbError) {
        console.error(`Rollback attempt ${attempt} failed:`, dbError);
      }

      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }

    if (!isDeleted) {
      console.error(
        `CRITICAL: Failed to remove user record after ${maxRetries} attempts for userId: ${user._id}`,
      );
      return ctx.helper.internal_server_error(
        `Failed to deliver login credentials via email, and rollback failed after ${maxRetries} attempts. Please contact support.`,
      );
    }

    return ctx.helper.internal_server_error(
      "Failed to deliver login credentials via email. Registration was successfully rolled back.",
    );
  }

  // 5. Success response
  return ctx.helper.success({
    success: true,
    message: "User registered successfully and credentials dispatched.",
    credentials: {
      id: user._id,
      emailId,
      rawPassword,
    },
  });
};

export default convenientUserRegistrationCtrl;
