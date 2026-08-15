import type { Request, Response, NextFunction } from "express";
import { chapterService, ChapterService } from "./chapter.service.js";
import { sendSuccess } from "../../utils/response.js";
import { AppError } from "../../utils/errors.js";

/**
 * Controller handling HTTP requests for the Manga Chapter and Page delivery slice.
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

  /**
   * GET /api/v1/manga/:slug/chapters/:chapterNumber/pages/:pageNumber
   * Streams a single chapter page binary with proper Content-Type and Cache-Control headers.
   */
  public getPage = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { slug, chapterNumber, pageNumber } = req.params;

      if (!slug || typeof slug !== "string" || slug.trim().length === 0) {
        throw AppError.badRequest("Manga slug parameter is required", "INVALID_SLUG");
      }

      if (chapterNumber === undefined || chapterNumber === "") {
        throw AppError.badRequest(
          "Chapter number parameter is required",
          "INVALID_CHAPTER_NUMBER"
        );
      }

      if (pageNumber === undefined || pageNumber === "") {
        throw AppError.badRequest(
          "Page number parameter is required",
          "INVALID_PAGE_NUMBER"
        );
      }

      const page = await this.service.getPage(slug, chapterNumber, pageNumber);

      res.setHeader("Content-Type", page.contentType);
      res.setHeader("Content-Length", page.data.length);
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");

      res.end(page.data);
    } catch (error) {
      next(error);
    }
  };
}

export const chapterController = new ChapterController();
