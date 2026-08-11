import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";

// Structured JSON in production so a log aggregator can index it; human-readable
// lines locally. Credentials and tokens are redacted at the logger level so no
// individual call site can leak them by accident.
export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isProduction ? "info" : "debug"),
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "res.headers['set-cookie']",
      "*.password",
      "*.accessToken",
      "*.token",
      "*.tokenHash",
    ],
    censor: "[redacted]",
  },
  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "HH:MM:ss",
            ignore: "pid,hostname",
          },
        },
      }),
});

export default logger;
