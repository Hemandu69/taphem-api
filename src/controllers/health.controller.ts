import type { Request, Response } from "express";
import { sendSuccess } from "../utils/response.js";

/**
 * Handles GET /api/v1/health
 * Returns standard system health status.
 */
export function getHealth(_req: Request, res: Response): void {
  sendSuccess(res, {
    status: "ok"
  });
}
