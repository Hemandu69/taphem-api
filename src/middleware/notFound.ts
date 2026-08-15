import type { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/errors.js";

/**
 * Catches unhandled routes and forwards a 404 AppError to the error handler.
 */
export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(new AppError(`Cannot ${req.method} ${req.originalUrl}`, 404, "NOT_FOUND"));
}
