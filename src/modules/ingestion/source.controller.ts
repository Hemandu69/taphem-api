import type { Request, Response, NextFunction } from "express";
import { AppError } from "../../utils/errors.js";
import { sendSuccess } from "../../utils/response.js";
import { sourceRegistry } from "./source.registry.js";

/**
 * Handles external source catalog search requests.
 * GET /api/v1/sources/:sourceId/search?q=...&page=1&limit=20
 */
export async function searchSourceManga(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { sourceId } = req.params;
    if (!sourceId || !sourceId.trim()) {
      throw AppError.badRequest("Source identifier is required in route path", "INVALID_SOURCE_ID");
    }

    const adapter = sourceRegistry.get(sourceId);
    if (!adapter) {
      throw AppError.notFound(
        `Source '${sourceId}' is not registered or supported`,
        "UNSUPPORTED_SOURCE"
      );
    }

    if (typeof adapter.searchManga !== "function") {
      throw AppError.badRequest(
        `Source '${sourceId}' does not support discovery/search`,
        "UNSUPPORTED_SEARCH"
      );
    }

    // 1. Validate 'q' (search query)
    const rawQuery = req.query.q;
    if (!rawQuery || typeof rawQuery !== "string" || !rawQuery.trim()) {
      throw AppError.badRequest(
        "Search query parameter 'q' is required and cannot be empty",
        "INVALID_QUERY_PARAMS"
      );
    }
    const q = rawQuery.trim();

    // 2. Validate 'page'
    let page = 1;
    if (req.query.page !== undefined) {
      const parsedPage = Number(req.query.page);
      if (!Number.isInteger(parsedPage) || parsedPage < 1) {
        throw AppError.badRequest(
          "Query parameter 'page' must be an integer greater than or equal to 1",
          "INVALID_QUERY_PARAMS"
        );
      }
      page = parsedPage;
    }

    // 3. Validate 'limit'
    let limit = 20;
    if (req.query.limit !== undefined) {
      const parsedLimit = Number(req.query.limit);
      if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
        throw AppError.badRequest(
          "Query parameter 'limit' must be an integer between 1 and 100",
          "INVALID_QUERY_PARAMS"
        );
      }
      limit = parsedLimit;
    }

    // 4. Delegate to adapter (does NOT persist to PostgreSQL)
    const result = await adapter.searchManga(q, { page, limit });

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}
