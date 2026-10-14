import {
  IRequest,
  IResponse,
  NextFunction,
  SubatomTokenError,
  token,
} from "subatom";
import envConfig from "../config/envConfig.js";

const authorizationMiddleware = async (
  req: IRequest,
  res: IResponse,
  next: NextFunction,
) => {
  try {
    let accessToken: string | null = null;

    // 1. Try to extract from parsed cookies (if Subatom attaches req.cookies)
    const cookies = (req as IRequest).cookies;
    if (cookies && cookies["access-token"]) {
      accessToken = cookies["access-token"];
    }

    // 2. Fallback: Parse the raw Cookie header manually if req.cookies isn't populated
    if (!accessToken && req.headers.cookie) {
      const cookieHeader = Array.isArray(req.headers.cookie)
        ? req.headers.cookie.join("; ")
        : req.headers.cookie;
      const match = cookieHeader.match(/(^|;\s*)access-token=([^;]*)/);
      if (match) {
        accessToken = decodeURIComponent(match[2]);
      }
    }

    // 3. Optional fallback: Check Authorization Bearer header if cookies are empty
    if (!accessToken) {
      const authHeader =
        req.headers.authorization || req.headers["Authorization"];
      if (authHeader) {
        accessToken = token.extractFromHeader(authHeader as string, "Bearer");
      }
    }

    // If no token is found anywhere, block the request
    if (!accessToken) {
      return res.status(401).json({
        status: "error",
        message: "Access denied. No access token provided in cookies.",
      });
    }

    // 4. Define your secret key (loaded from environment variables in production)
    const jwtSecret = envConfig.JWT_ACCESS_SECRET;

    // 5. Verify the token's signature and expiration
    const decodedPayload = token.verify(accessToken, jwtSecret);

    // 6. Attach user payload to the request object for downstream controllers
    (req as IRequest & { user?: unknown }).user = decodedPayload;

    // 7. Proceed to the next middleware or controller
    return next();
  } catch (error) {
    // Handle token expiration or validation failure cleanly
    const message =
      error instanceof SubatomTokenError
        ? (error as Error).message
        : "Unauthorized request";

    return res.status(401).json({
      status: "error",
      message: message,
    });
  }
};

export default authorizationMiddleware;
