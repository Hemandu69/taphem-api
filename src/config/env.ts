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
    )
});

/**
 * Parses and validates environment variables.
 * Exits the process cleanly with detailed diagnostics if validation fails.
 */
export function validateEnv() {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errorDetails = result.error.issues
      .map((issue) => ` - [${issue.path.join(".") || "GLOBAL"}]: ${issue.message}`)
      .join("\n");

    console.error("==================================================");
    console.error("FATAL: Environment configuration validation failed:");
    console.error(errorDetails);
    console.error("==================================================");
    process.exit(1);
  }

  return {
    nodeEnv: result.data.NODE_ENV,
    port: result.data.PORT,
    corsOrigins: result.data.CORS_ORIGINS,
    isProduction: result.data.NODE_ENV === "production",
    isDevelopment: result.data.NODE_ENV === "development",
    isTest: result.data.NODE_ENV === "test"
  };
}

export type EnvConfig = ReturnType<typeof validateEnv>;
