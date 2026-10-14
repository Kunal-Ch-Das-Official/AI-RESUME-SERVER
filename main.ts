//! Adjust path according to your project if mismatch..
import type { Server as HttpServer } from "node:http";
import { initSocket, type SubatomPulseInstance } from "./src/web-socket/socket.js";
import server from "./src/server.js";
import { bootstrapRedis } from "./src/redis/redis.bootstrap.js";
import connectDB from "./src/config/mongoConnect.js";
import mongoose from "mongoose";

async function main(): Promise<void> {
  let httpServer: HttpServer | null = null;
  let io: SubatomPulseInstance | null = null;
  let isDraining = false;

  const gracefulShutdown = async (signal: string) => {
    if (isDraining) {return};
    isDraining = true;

    console.warn(`\n🛑 [Shutdown] Received ${signal}. Starting coordinated teardown...`);

    const forceExitTimer = setTimeout(() => {
      console.error("⚠️ [Shutdown] Draining timed out. Forcing process exit.");
      process.exit(1);
    }, 10_000);
    forceExitTimer.unref();

    try {
      // 1. Terminate WebSocket connections
      if (io) {
        console.info("🔌 [Shutdown] Closing WebSocket engine...");
        await io.close();
      }

      // 2. Stop HTTP listener
      if (httpServer && typeof httpServer.close === "function") {
        console.warn("🌐 [Shutdown] Stopping HTTP listener...");
        await new Promise((resolve, reject) => {
         httpServer!.close((err) => (err ? reject(err) : resolve(undefined)));
        });
      }

      // 3. Disconnect database (if any)
      if (mongoose.connection.readyState !== 0) {
        console.info("🗄️ [Shutdown] Disconnecting Mongoose...");
        await mongoose.disconnect();
      }
      console.info("✅ [Shutdown] Clean shutdown completed.");
      process.exit(0);
    } catch (error) {
      console.error("❌ [Shutdown] Error during teardown:", error);
      process.exit(1);
    }
  };

  process.once("SIGTERM", () => void gracefulShutdown("SIGTERM"));
  process.once("SIGINT", () => void gracefulShutdown("SIGINT"));

  process.on("unhandledRejection", (reason) => {
    console.error("🚨 Unhandled Rejection at:", reason);
  });

  process.on("uncaughtException", (error) => {
    console.error("🚨 Uncaught Exception thrown:", error);
    void gracefulShutdown("UNCAUGHT_EXCEPTION");
  });

  try {
    console.info("⏳ Connecting to MongoDB (Mongoose)...");
    await connectDB();
    console.info("✅ Connected to MongoDB successfully");
console.info("⏳ Initializing Redis client...");
    await bootstrapRedis();
    console.info("✅ Redis initialized");
    // HTTP Engine
    console.info("⏳ Starting Subatom HTTP engine...");
    httpServer = await server.start();
    console.info("✅ Subatom HTTP engine listening");

      // WebSocket mount
    if (!httpServer) {
      throw new Error("HTTP server failed to initialize before WebSocket mount.");
    }

    // WebSocket mount
    io = initSocket(httpServer);
    console.info("✅ Subatom Pulse mounted on /ws");
  } catch (error) {
    console.error("❌ Startup sequence failed:", error as Error);
    await gracefulShutdown("STARTUP_FAILURE");
  }
}

await main();
