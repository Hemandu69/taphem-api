import type {
  Chapter,
  ChapterRepository,
  ChapterSummary
} from "./chapter.types.js";
import { chapterRepository } from "./chapter.repository.js";
import { mangaRepository } from "../manga/manga.repository.js";
import type { MangaRepository } from "../manga/manga.types.js";
import { AppError } from "../../utils/errors.js";

/**
 * Service managing Manga Chapter business logic, validation, and domain rules.
 */
export class ChapterService {
  constructor(
    private readonly chapterRepo: ChapterRepository = chapterRepository,
    private readonly mangaRepo: MangaRepository = mangaRepository
  ) {}

  /**
   * Retrieves chapter summaries for a given manga slug.
   * Validates that the manga exists before returning chapters.
   */
  public async getChaptersByMangaSlug(slug: string): Promise<ChapterSummary[]> {
    const trimmedSlug = slug?.trim();
    if (!trimmedSlug) {
      throw AppError.badRequest("Manga slug parameter is required", "INVALID_SLUG");
    }

    // 1. Verify manga exists in the catalog
    const manga = await this.mangaRepo.findBySlug(trimmedSlug);
    if (!manga) {
      throw AppError.notFound(`Manga '${trimmedSlug}' was not found`, "MANGA_NOT_FOUND");
    }

    // 2. Retrieve chapter summaries
    return this.chapterRepo.findByMangaSlug(trimmedSlug);
  }

  /**
   * Retrieves a full chapter with ordered pages for a given manga slug and chapter number.
   * Validates manga existence, chapter number format, and chapter existence.
   */
  public async getChapterByNumber(
    slug: string,
    chapterNumberParam: string | number
  ): Promise<Chapter> {
    const trimmedSlug = slug?.trim();
    if (!trimmedSlug) {
      throw AppError.badRequest("Manga slug parameter is required", "INVALID_SLUG");
    }

    // 1. Validate chapter number is a valid positive integer
    const parsedNumber = Number(chapterNumberParam);
    if (
      isNaN(parsedNumber) ||
      !Number.isInteger(parsedNumber) ||
      parsedNumber <= 0
    ) {
      throw AppError.badRequest(
        `Invalid chapter number '${chapterNumberParam}'. Chapter number must be a positive integer.`,
        "INVALID_CHAPTER_NUMBER"
      );
    }

    // 2. Verify manga exists in the catalog
    const manga = await this.mangaRepo.findBySlug(trimmedSlug);
    if (!manga) {
      throw AppError.notFound(`Manga '${trimmedSlug}' was not found`, "MANGA_NOT_FOUND");
    }

    // 3. Retrieve specific chapter
    const chapter = await this.chapterRepo.findByMangaSlugAndChapterNumber(
      trimmedSlug,
      parsedNumber
    );

    if (!chapter) {
      throw AppError.notFound(
        `Chapter ${parsedNumber} for manga '${trimmedSlug}' was not found`,
        "CHAPTER_NOT_FOUND"
      );
    }

    return chapter;
  }
}

export const chapterService = new ChapterService();
