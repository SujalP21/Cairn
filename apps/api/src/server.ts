import http from "node:http";
import mongoose from "mongoose";
import { Server } from "socket.io";
import { createApp, buildCorsOptions } from "./app";
import { loadEnv } from "./config/env";
import { logger } from "./lib/logger";
import { registerSocketHandlers } from "./services/socketService";

export async function startServer(): Promise<void> {
  // Fail fast: a misconfigured server should never reach the listen call.
  const env = loadEnv();
  const app = createApp();

  try {
    await mongoose.connect(env.MONGODB_URI);
    logger.info("MongoDB connected!");
  } catch (err) {
    logger.fatal({ err }, "Unable to connect to MongoDB");
    process.exit(1);
  }

  const httpServer = http.createServer(app);
  const io = new Server(httpServer, {
    cors: buildCorsOptions(env.corsOrigins),
  });

  registerSocketHandlers(io);

  httpServer.listen(env.PORT, () => {
    logger.info(`Server is running on PORT ${env.PORT}`);
  });

  const shutdown = (signal: string) => {
    logger.info({ signal }, "Shutting down");

    httpServer.close(() => {
      void mongoose.connection.close().then(() => process.exit(0));
    });

    // Do not hang forever on a stuck connection.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}
