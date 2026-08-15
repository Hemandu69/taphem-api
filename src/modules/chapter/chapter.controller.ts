import type { Request, Response, NextFunction } from "express";
import { chapterService, ChapterService } from "./chapter.service.js";
import { sendSuccess } from "../../utils/response.js";
import { AppError } from "../../utils/errors.js";

/**
 * Controller handling HTTP requests for the Manga Chapter slice.
 */
export class ChapterController {
  constructor(private readonly service: ChapterService = chapterService) {}

  /**
   * GET /api/v1/manga/:slug/chapters
   * Returns all chapter summaries for a manga.
   */
  public getChapters = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { slug } = req.params;
      if (!slug || typeof slug !== "string" || slug.trim().length === 0) {
        throw AppError.badRequest("Manga slug parameter is required", "INVALID_SLUG");
      }

      const chapters = await this.service.getChaptersByMangaSlug(slug);
      sendSuccess(res, chapters);
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/v1/manga/:slug/chapters/:chapterNumber
   * Returns a complete chapter with ordered pages.
   */
  public getChapterByNumber = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { slug, chapterNumber } = req.params;

      if (!slug || typeof slug !== "string" || slug.trim().length === 0) {
        throw AppError.badRequest("Manga slug parameter is required", "INVALID_SLUG");
      }

      if (chapterNumber === undefined || chapterNumber === "") {
        throw AppError.badRequest(
          "Chapter number parameter is required",
          "INVALID_CHAPTER_NUMBER"
        );
      }

      const chapter = await this.service.getChapterByNumber(slug, chapterNumber);
      sendSuccess(res, chapter);
    } catch (error) {
      next(error);
    }
  };
}

export const chapterController = new ChapterController();
