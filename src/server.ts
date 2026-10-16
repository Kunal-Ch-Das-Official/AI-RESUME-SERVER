import { Subatom, SubAtomDocs, type ISubatom, type IRequest, type IResponse, serveStatic, cors } from "subatom";
import { getIO } from "./web-socket/socket.js";
import resumeRouter from "./routes/resume.route.js";
import authRouter from "./routes/auth.route.js";
import envConfig from "./config/envConfig.js";

const server: ISubatom = new Subatom();

// Server static file from public directory
server.use(serveStatic("public"))

server.use(cors({
  origin: envConfig.CLIENT_URL,
  methods: ["POST", "PUT", "GET", "PATCH", "DELETE"],
  credentials: true, // Recommended if you are sending cookies or headers
}));


// Root route
server.get("/", async (_req:IRequest, res:IResponse) => {
  return res.status(200).json({ message: "Subatom API is running" });
});

// Real-time socket metrics
server.get("/metrics", async (_req:IRequest, res:IResponse) => {
  try {
    const io = getIO();
    return res.status(200).json(io.getMetrics());
  } catch {
    return res.status(503).json({ error: "Socket engine not ready" });
  }
});

// API Routes
// server.use("/api/v1", userRouter);
server.use("/api/v1/auth", authRouter)
server.use("/api/v1/resume", resumeRouter)

// API Documentation at /docs
SubAtomDocs(server, {
  path: "/docs",
  title: "Subatom Pulse API",
  version: "1.0.0",
});

export default server;