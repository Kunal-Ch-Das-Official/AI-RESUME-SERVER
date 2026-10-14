import { type IRouter, Router } from "subatom";
import {
  fetchUserSchema,
  myResumeSchema,
  passwordResetLinkSendSchema,
  passwordUpdateSchema,
  resetPasswordSchema,
  userLoginSchema,
  userRegistrationSchema,
} from "../schema/auth.schema.js";
import userRegistrationCtrl from "../controllers/auth/userReg.controller.js";
import userLoginController from "../controllers/auth/userLogin.controller.js";
import authorizationMiddleware from "../middlewares/authorization.middleware.js";
import loggedInUserController from "../controllers/auth/loggedInUser.controller.js";
import logoutController from "../controllers/auth/logout.controller.js";
import updatePasswordController from "../controllers/auth/updatePassword.controller.js";
import {
  resetForgottenPassword,
  sendPasswordResetLinkController,
} from "../controllers/auth/passwordReset.controller.js";
import convenientUserRegistrationCtrl from "../controllers/auth/convenient-auth/userRegistration.controller.js";
import addNewResumeController from "../controllers/auth/my-resune/addNewResume.controller.js";
import fetchUsersController from "../controllers/auth/fetchUsers.controller.js";


const authRouter: IRouter = new Router();

// Method 1: Create a new user with optional avatar upload
authRouter.post("/registration", {
  name: "auth.registration",
  tags: ["Authentication"],
  schema: userRegistrationSchema,
  controller: userRegistrationCtrl,
});

authRouter.post("/login", {
  name: "auth.login",
  tags: ["Authentication"],
  schema: userLoginSchema,
  controller: userLoginController,
});

authRouter.get("/user", {
  name: "auth.loggedin.user",
  tags: ["Authentication"],
  middleware: [authorizationMiddleware],
  controller: loggedInUserController,
});


authRouter.get("/users/:userId", {
  name: "auh.fetch.users",
  tags: ["Authentication"],
  schema: fetchUserSchema,
  controller: fetchUsersController

})
authRouter.post("/logout", {
  name: "auth.logout",
  tags: ["Authentication"],
  middleware: [authorizationMiddleware],
  controller: logoutController,
});

authRouter.put("/update-password", {
  name: "auth.password.update",
  tags: ["Authentication"],
  schema: passwordUpdateSchema,
  middleware: [authorizationMiddleware],
  controller: updatePasswordController,
});

authRouter.post("/reset-password-link", {
  name: "auth.password.reset.link",
  tags: ["Authentication"],
  schema: passwordResetLinkSendSchema,
  controller: sendPasswordResetLinkController,
});

authRouter.put("/reset-password/:userId/:accessToken", {
  name: "auth.password.reset",
  tags: ["Authentication"],
  schema: resetPasswordSchema,
  controller: resetForgottenPassword,
});

// CONVENIENT
authRouter.post("/convenient-registration", {
  name: "convenient.registration",
  tags: ["Convenient-Authentication"],
  schema: userRegistrationSchema,
  controller: convenientUserRegistrationCtrl,
});

authRouter.post("/add-resume-id", {
  name: "add.my.resume.id",
  tags: ["Add-My-Resume"],
  schema: myResumeSchema,
  controller: addNewResumeController,
});
export default authRouter;
