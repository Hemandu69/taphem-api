import type { Response } from "express";
import type { ApiResponse, ApiErrorResponse } from "../types/index.js";

/**
 * Sends a standardized success JSON response.
 */
export function sendSuccess<T>(res: Response, data: T, statusCode = 200): Response {
  const payload: ApiResponse<T> = {
    success: true,
    data
  };
  return res.status(statusCode).json(payload);
}

/**
 * Sends a standardized error JSON response.
 */
export function sendError(
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  details?: unknown,
  externalUrl?: string
): Response {
  const payload: ApiErrorResponse = {
    success: false,
    error: {
      code,
      message,
      ...(externalUrl ? { externalUrl } : {}),
      ...(details !== undefined ? { details } : {})
    }
  };
  return res.status(statusCode).json(payload);
}
