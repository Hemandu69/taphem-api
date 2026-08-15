import dotenv from "dotenv";
import { z } from "zod";

// Load .env file into process.env if present
dotenv.config();

/**
 * Zod schema for environment variables.
 */
const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z
    .string()
    .default("4000")
    .transform((val) => parseInt(val, 10))
    .pipe(
      z
        .number()
        .int()
        .min(1, "PORT must be at least 1")
        .max(65535, "PORT must be at most 65535")
    ),
  CORS_ORIGINS: z
    .string()
    .default("")
    .transform((val) =>
      val
        .split(",")
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0)
    ),
  MANGA_CDN_BASE_URL: z
    .string()
    .default("")
    .transform((val) => val.trim().replace(/\/+$/, "")),
  DATABASE_URL: z
    .string()
    .default("")
    .transform((val) => val.trim()),
  MANGADEX_API_BASE_URL: z
    .string()
    .default("https://api.mangadex.org")
    .transform((val) => val.trim().replace(/\/+$/, "")),
  MANGADEX_REQUEST_TIMEOUT_MS: z
    .string()
    .default("10000")
    .transform((val) => parseInt(val, 10))
    .pipe(
      z
        .number()
        .int()
        .min(500, "MANGADEX_REQUEST_TIMEOUT_MS must be at least 500ms")
        .max(60000, "MANGADEX_REQUEST_TIMEOUT_MS cannot exceed 60000ms")
    )
});

/**
 * Parses and validates environment variables.
 * Exits the process cleanly with detailed diagnostics if validation fails.
 */
export function validateEnv() {
  try {
    const env = envSchema.parse(process.env);

    return {
      nodeEnv: env.NODE_ENV,
      port: env.PORT,
      corsOrigins: env.CORS_ORIGINS,
      mangaCdnBaseUrl: env.MANGA_CDN_BASE_URL,
      databaseUrl: env.DATABASE_URL,
      mangadexApiBaseUrl: env.MANGADEX_API_BASE_URL,
      mangadexRequestTimeoutMs: env.MANGADEX_REQUEST_TIMEOUT_MS,
      isProduction: env.NODE_ENV === "production",
      isDevelopment: env.NODE_ENV === "development",
      isTest: env.NODE_ENV === "test"
    };
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      const errorDetails = error.issues
        .map((issue) => ` - [${issue.path.join(".") || "GLOBAL"}]: ${issue.message}`)
        .join("\n");

      console.error("==================================================");
      console.error("FATAL: Environment configuration validation failed:");
      console.error(errorDetails);
      console.error("==================================================");
    } else {
      console.error("FATAL: Unexpected error validating environment:", error);
    }
    process.exit(1);
  }
}

export type EnvConfig = ReturnType<typeof validateEnv>;
