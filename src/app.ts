import express, { type Express } from "express";
import helmet from "helmet";
import { createCorsMiddleware } from "./middleware/cors.js";
import { notFoundHandler } from "./middleware/notFound.js";
import { errorHandler } from "./middleware/error.js";
import { v1Router } from "./routes/index.js";

/**
 * Creates and configures the Express application.
 */
export function createApp(): Express {
  const app = express();

  // Basic security headers
  app.use(helmet());

  // Multi-origin CORS support
  app.use(createCorsMiddleware());

  // Request body parsing
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // API v1 namespace
  app.use("/api/v1", v1Router);

  // 404 handler for unmatched routes
  app.use(notFoundHandler);

  // Centralized error handler
  app.use(errorHandler);

  return app;
}
