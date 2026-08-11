import express, { type Express } from "express";
import cors, { type CorsOptions } from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import { randomUUID } from "node:crypto";
import mainRouter from "./routes/main.router";
import { apiLimiter } from "./middleware/rateLimit";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { logger } from "./lib/logger";
import { loadEnv } from "./config/env";
import "./models"; // registers every schema before any populate() runs

export function buildCorsOptions(allowedOrigins: string[]): CorsOptions {
  return {
    origin(origin, callback) {
      // Same-origin and non-browser callers (curl, the CLI) send no Origin.
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // Reflect no CORS headers rather than throwing: the browser is the thing
      // that enforces this, and throwing would turn every probe into a 500.
      return callback(null, false);
    },
    credentials: true,
  };
}

/**
 * Builds the Express app without binding a port, so integration tests can drive
 * it through supertest and the server entry point stays a thin wrapper.
 */
export function createApp(): Express {
  const env = loadEnv();
  const app = express();

  // Trust the first proxy hop so express-rate-limit keys on the real client IP
  // rather than the load balancer's.
  app.set("trust proxy", 1);

  app.use(
    pinoHttp({
      logger,
      genReqId: (req, res) => {
        const existing = req.headers["x-request-id"];
        const id = typeof existing === "string" ? existing : randomUUID();
        res.setHeader("x-request-id", id);
        return id;
      },
      // Client errors are not server faults; keep them out of the error stream.
      customLogLevel(_req, res, err) {
        if (err || res.statusCode >= 500) return "error";
        if (res.statusCode >= 400) return "warn";
        return "info";
      },
    })
  );

  app.use(cors(buildCorsOptions(env.corsOrigins)));
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(apiLimiter);

  app.use("/", mainRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
