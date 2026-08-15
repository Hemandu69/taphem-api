import type { Request, Response, NextFunction } from "express";
import { config } from "../config/index.js";
import { AppError } from "../utils/errors.js";
import { sendError } from "../utils/response.js";

interface SyntaxErrorWithStatus extends SyntaxError {
  status?: number;
  body?: string;
}

/**
 * Centralized application error handling middleware.
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Handle JSON parse errors from express.json()
  if (err instanceof SyntaxError && "status" in err && (err as SyntaxErrorWithStatus).status === 400) {
    sendError(res, 400, "MALFORMED_JSON", "Malformed JSON in request body");
    return;
  }

  // Handle known operational AppErrors
  if (err instanceof AppError) {
    sendError(res, err.statusCode, err.code, err.message, err.details);
    return;
  }

  // Handle unknown/unexpected errors
  const isProd = config.isProduction;
  const message = isProd
    ? "Internal server error"
    : err instanceof Error
      ? err.message
      : "Unknown server error";

  // Log unexpected errors for operational visibility
  console.error("Unhandled Error:", err);

  sendError(res, 500, "INTERNAL_SERVER_ERROR", message);
}
