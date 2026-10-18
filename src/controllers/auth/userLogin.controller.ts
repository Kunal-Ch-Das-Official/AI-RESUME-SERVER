import { hash, IController, token } from "subatom";
import { userLoginSchema } from "../../schema/auth.schema.js";
import UserModel from "../../models/usersData.js";
import envConfig from "../../config/envConfig.js";

const userLoginController: IController<typeof userLoginSchema> = async (
  ctx,
) => {
  const { userName, emailId, password } = ctx.body;

  // Validate that at least one identifier is provided
  if (!userName && !emailId) {
    return ctx.helper.bad_request(
      "Either username or email is required for login.",
    );
  }

  // Find user: prioritize emailId if given, otherwise use userName
  const query = emailId ? { emailId: emailId } : { userName: userName };
  const user = await UserModel.findOne(query);

  if (!user) {
    return ctx.helper.not_found("Requested user not found.");
  }

  // Safety check: ensure the user actually has a stored password hash
  if (!user.password) {
    return ctx.helper.unauthorized(
      "Authentication configuration error for this user.",
    );
  }

  // Verify password
  const isPasswordValid = hash.verify(password, user.password, 32);

  if (!isPasswordValid) {
    return ctx.helper.unauthorized("Invalid credentials provided.");
  }

  // Define secrets and payload
  const accessSecret = envConfig.JWT_ACCESS_SECRET;
  const refreshSecret = envConfig.JWT_REFRESH_SECRET;

  const payload = {
    id: user._id,
    userName: user.userName,
    userEmail: user.emailId,
    fullName: user.fullName,
    myResume: user.myResume,
    paymentHistory: user.paymentHistory,
    resumeCredits: user.resumeCredits,
    activePlan: user.activePlan,
  };

  // Generate Access & Refresh tokens
  const tokens = token.pair(
    payload,
    accessSecret,
    refreshSecret,
    { expiresIn: "15m" },
    { expiresIn: "7d" },
  );

  // Cookie configuration options
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Lax" as const,
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };

  // Set tokens in secure cookies
  ctx.cookie("access-token", tokens.accessToken, {
    ...cookieOptions,
    maxAge: 15 * 60 * 1000,
  });
  ctx.cookie("refresh-token", tokens.refreshToken, cookieOptions);

  // Return successful response with user details
  return ctx.status(200).json({
    message: "Login successful",
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    user: {
      id: user._id,
      userName: user.userName,
      emailId: user.emailId,
      fullName: user.fullName,
      resumeCredits: user.resumeCredits
    },
  });
};

export default userLoginController;
