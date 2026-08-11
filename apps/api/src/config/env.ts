import path from "node:path";
import dotenv from "dotenv";
import { z } from "zod";

// Loaded relative to this package, not the caller's cwd, so `cairn` works when
// invoked from inside any repository directory.
dotenv.config({ path: path.resolve(__dirname, "..", "..", ".env") });

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    // 0 is valid and means "let the OS pick a free port", which tests rely on.
    PORT: z.coerce.number().int().min(0).max(65535).default(3002),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .optional(),

    MONGODB_URI: z
      .string()
      .min(1, "is required")
      .refine(
        (uri) =>
          uri.startsWith("mongodb://") || uri.startsWith("mongodb+srv://"),
        "must start with mongodb:// or mongodb+srv://"
      ),

    JWT_ACCESS_SECRET: z
      .string()
      .min(
        32,
        "must be at least 32 characters — generate one with: node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\""
      ),
    ACCESS_TOKEN_TTL: z.string().default("15m"),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),

    // Comma-separated list of browser origins allowed to call the API.
    CORS_ORIGINS: z.string().default("http://localhost:5173"),

    AWS_REGION: z.string().default("ap-south-1"),
    S3_BUCKET: z.string().optional(),
  })
  .transform((env) => ({
    ...env,
    corsOrigins: env.CORS_ORIGINS.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
    isProduction: env.NODE_ENV === "production",
  }));

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

/**
 * Validates process.env and exits with an actionable message if anything is
 * missing. Called at server startup so misconfiguration fails immediately
 * rather than at the first request. CLI commands never call this.
 */
export function loadEnv(): Env {
  if (cached) return cached;

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const details = result.error.issues
      .map(
        (issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`
      )
      .join("\n");

    // Deliberately console.error, not the logger: this runs before logging is
    // configured, and a startup misconfiguration must be readable as plain text.
    console.error(
      `\nInvalid environment configuration:\n${details}\n\n` +
        `Copy apps/api/.env.example to apps/api/.env and fill in the missing values.\n`
    );
    process.exit(1);
  }

  cached = result.data;
  return cached;
}
