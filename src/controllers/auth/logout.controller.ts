import { IController } from "subatom";

const logoutController: IController = async (ctx) => {
    // Clear both access and refresh token cookies
    ctx.clearCookie("access-token");
    ctx.clearCookie("refresh-token");

    // Send a success response back to the client
    return ctx.status(200).json({
        message: "Logged out successfully"
    });
};

export default logoutController;