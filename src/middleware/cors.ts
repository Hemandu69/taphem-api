import cors, { type CorsOptions } from "cors";
import { config } from "../config/index.js";
import { AppError } from "../utils/errors.js";

type CorsOriginCallback = (err: Error | null, allow?: boolean) => void;

/**
 * Generates CORS options based on validated environment configuration.
 * Multi-origin support without hardcoding origins in source code.
 */
export function createCorsMiddleware() {
  const allowedOrigins = config.corsOrigins;

  const corsOptions: CorsOptions = {
    origin: (origin: string | undefined, callback: CorsOriginCallback) => {
      // Allow requests with no origin (like mobile apps, curl, server-to-server, health monitors)
      if (!origin) {
        return callback(null, true);
      }

      // If no origins configured, reject or allow depending on environment
      if (allowedOrigins.length === 0) {
        if (config.isDevelopment) {
          // Allow in local development if no origins explicitly restricted
          return callback(null, true);
        }
        return callback(
          new AppError("CORS origin not allowed by server configuration", 403, "CORS_FORBIDDEN")
        );
      }

      // Match origin against configured whitelist
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(
        new AppError(
          `Origin '${origin}' not allowed by CORS policy`,
          403,
          "CORS_FORBIDDEN"
        )
      );
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"]
  };

  return cors(corsOptions);
}
