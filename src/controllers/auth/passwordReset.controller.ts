import { hash, IController, token } from "subatom";
import {
  passwordResetLinkSendSchema,
  resetPasswordSchema,
} from "../../schema/auth.schema.js";
import UserModel from "../../models/usersData.js";
import envConfig from "../../config/envConfig.js";
import sendAlertMessage from "../../emails/sendAlertMessage.js";

// ============================================
// 1. Password Reset Link Send Via Email
// ============================================

const sendPasswordResetLinkController: IController<
  typeof passwordResetLinkSendSchema
> = async (ctx) => {
  const { userName, emailId } = ctx.body;

  try {
    // Validate that at least one identifier is provided
    if (!userName && !emailId) {
      return ctx.helper.bad_request(
        "Either username or email is required for login.",
      );
    }

    // Find user: prioritize emailId if given, otherwise use userName
    const query = emailId ? { emailId: emailId } : { userName: userName };
    const isUserExist = await UserModel.findOne(query);

    if (!isUserExist)
      return ctx.helper.not_found("Requested user does not exists.");

    const resetToken = token.sign(
      { userId: isUserExist._id },
      envConfig.JWT_ACCESS_SECRET,
      { expiresIn: "15m" },
    );
    const resetLink = `${envConfig.CLIENT_URL}/reset-password/${isUserExist._id}/${resetToken}`;

    try {
      await sendAlertMessage(
        isUserExist.emailId,
        envConfig.SMTP_SENDER,
        "Password Reset Request - AI-Resume",
        `
        <p>Dear ${isUserExist.userName || "User"},</p>
        <p>We received a request to reset your password. Please click the link below to set a new password. This link is valid for 15 minutes.</p>
        <p><a href="${resetLink}" target="_blank" style="color: #2563eb;">Reset Your Password</a></p>
        <p>If you did not request a password reset, please ignore this email.</p>
        <p>Best regards,<br/>AI-Resume Team</p>
        `,
      );
    } catch (error: unknown) {
      console.error(
        "Failed to send password reset email:",
        (error as Error).message,
      );
      return ctx.helper.internal_server_error(
        "Unable to send email, Please try again later.",
      );
    }

    return ctx.helper.success(
      "Password reset link has been sended to the register email address.",
    );
  } catch (error: unknown) {
    console.error("Something went wrong.", (error as Error).message);
    return ctx.helper.internal_server_error((error as Error).message);
  }
};

// ============================================
// 2. Update Password
// ============================================

const resetForgottenPassword: IController<typeof resetPasswordSchema> = async (
  ctx,
) => {
  const { userId, accessToken } = ctx.params;
  const { password, confirmPassword } = ctx.body;

  try {
    if (!userId || !accessToken)
      return ctx.helper.bad_request("All parameters are require to proceed!");

    if (password !== confirmPassword)
      return ctx.helper.bad_request(
        "Password and confirm password must be same.",
      );

    const isValidUser = await UserModel.findById(userId);

    if (!isValidUser)
      return ctx.helper.not_found(
        "User does not exist associating with given user id.",
      );

    try {
      token.verify(accessToken, envConfig.JWT_ACCESS_SECRET);
    } catch (error: unknown) {
      return ctx.helper.unprocessable_content(`${(error as Error).message}`);
    }

    const passHash = hash.password(password, { keylen: 32 });

    const updatePassword = await UserModel.findByIdAndUpdate(isValidUser._id, {
      $set: { password: passHash },
    });

    if (!updatePassword)
      return ctx.helper.not_implemented(
        "Unable to update password, please try again.",
      );

    try {
      await sendAlertMessage(
        isValidUser.emailId,
        envConfig.SMTP_SENDER,
        "Password Successfully Reset - AI-Resume",
        `
        <p>Dear ${isValidUser.fullName || "User"},</p>
        <p>Your password has been successfully reset.</p>
        <p>If you did not initiate this change, please contact our support team immediately.</p>
        <p>Best regards,<br/>AI-Resume Team</p>
        `,
      );
    } catch (error: unknown) {
      console.error(
        "⚠️ Failed to send confirmation email:",
        (error as Error).message,
      );
    }

    return ctx.helper.success("Password has been successfully reset.");
  } catch (error: unknown) {
    return ctx.helper.internal_server_error((error as Error).message);
  }
};

export { sendPasswordResetLinkController, resetForgottenPassword };
