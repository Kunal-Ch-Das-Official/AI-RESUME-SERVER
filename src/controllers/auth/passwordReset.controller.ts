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
      const mailResult = await sendAlertMessage(
        isUserExist.emailId,
        "Password Reset Request - AI-Resume",
        `
  <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #0f172a;">Password Reset Request</h2>
  <p style="margin: 0 0 14px 0; color: #475569;">Hello ${isUserExist.userName || "there"},</p>
  <p style="margin: 0 0 24px 0; color: #475569;">We received a request to reset your password. Click the button below to set a new password. This link is valid for <strong>15 minutes</strong>.</p>

  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 28px 0;">
    <tr>
      <td align="center">
        <a href="${resetLink}" target="_blank" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; padding: 13px 32px; border-radius: 8px;">
          Reset Password
        </a>
      </td>
    </tr>
  </table>

  <p style="margin: 24px 0 0 0; font-size: 13px; color: #64748b;">If you did not request a password reset, you can safely ignore this email.</p>
  `,
        envConfig.SMTP_BUSINESS_EMAIL,
      );

      if (!mailResult.success) {
        console.error(
          "Failed to send password reset email:",
          mailResult.details,
        );
        return ctx.helper.internal_server_error(
          "Unable to send email, Please try again later.",
        );
      }
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
        "Password Successfully Reset - AI-Resume",
        `
  <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #0f172a;">Password Changed Successfully</h2>
  <p style="margin: 0 0 14px 0; color: #475569;">Hello ${isValidUser.fullName || isValidUser.userName || "there"},</p>
  <p style="margin: 0 0 16px 0; color: #475569;">The password for your AI-Resume account was successfully updated.</p>
  <div style="background-color: #fff1f2; border-left: 4px solid #f43f5e; padding: 12px 16px; border-radius: 0 8px 8px 0; margin-top: 20px;">
    <p style="margin: 0; font-size: 13px; color: #9f1239;">
      <strong>Security Alert:</strong> If you did not make this change, please contact support at <a href="mailto:${envConfig.SMTP_BUSINESS_EMAIL || "team@ai-resume.download"}" style="color: #9f1239; font-weight: 600;">${envConfig.SMTP_BUSINESS_EMAIL || "team@ai-resume.download"}</a> immediately.
    </p>
  </div>
  `,
        envConfig.SMTP_BUSINESS_EMAIL,
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
