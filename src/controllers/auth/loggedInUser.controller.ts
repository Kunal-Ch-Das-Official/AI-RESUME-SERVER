import { IController } from "subatom";


const loggedInUserController: IController = async (ctx) => {
  if (!ctx.user)
    return ctx.helper.no_content("User does not exist in context.");

  return ctx.status(200).json(ctx.user);
};

export default loggedInUserController;
