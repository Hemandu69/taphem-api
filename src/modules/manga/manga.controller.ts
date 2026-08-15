import type { Request, Response, NextFunction } from "express";
import { mangaService, MangaService } from "./manga.service.js";
import { sendSuccess } from "../../utils/response.js";
import { AppError } from "../../utils/errors.js";

/**
 * Controller handling HTTP requests for the Manga catalog slice.
 */
export class MangaController {
  constructor(private readonly service: MangaService = mangaService) {}

  /**
   * GET /api/v1/manga
   * Returns the list of all manga in the catalog.
   */
  public getAllManga = async (
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const mangaList = await this.service.getAllManga();
      sendSuccess(res, mangaList);
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/v1/manga/:slug
   * Returns a single manga record by slug.
   */
  public getMangaBySlug = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { slug } = req.params;
      if (!slug || typeof slug !== "string" || slug.trim().length === 0) {
        throw AppError.badRequest("Manga slug parameter is required", "INVALID_SLUG");
      }

      const manga = await this.service.getMangaBySlug(slug);
      sendSuccess(res, manga);
    } catch (error) {
      next(error);
    }
  };
}

export const mangaController = new MangaController();
