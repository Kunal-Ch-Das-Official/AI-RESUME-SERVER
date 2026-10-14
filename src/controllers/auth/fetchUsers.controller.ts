import { IController } from "subatom";
import UserModel from "../../models/usersData.js";
import { fetchUserSchema } from "../../schema/auth.schema.js";


const fetchUsersController: IController<typeof fetchUserSchema> = async (ctx) => {
  try {
    if (ctx.params.userId) {
      const fetchUserById = await UserModel.findById(ctx.params.userId);
      if (!fetchUserById) {
        return ctx.helper.not_found("Requested user not found..");
      } else {
        return ctx.helper.success(fetchUserById);
      }
    } else {
      const finaAllUser = await UserModel.find();
      return ctx.helper.success(finaAllUser);
    }
  } catch (error: unknown) {
    return ctx.helper.internal_server_error((error as Error).message);
  }
};

export default fetchUsersController;
