import type {
  Chapter,
  ChapterRepository,
  ChapterSummary
} from "./chapter.types.js";
import { chapterRepository } from "./chapter.repository.js";
import { mangaRepository } from "../manga/manga.repository.js";
import type { MangaRepository } from "../manga/manga.types.js";
import { storageService, type MangaStorageService } from "../../infrastructure/storage/index.js";
import { MangaDexClient, type MangaDexHttpClient } from "../ingestion/adapters/mangadex/mangadex.client.js";
import { AppError } from "../../utils/errors.js";

/**
 * Service managing Manga Chapter business logic, validation, on-demand page resolution, and domain rules.
 */
export class ChapterService {
  constructor(
    private readonly chapterRepo: ChapterRepository = chapterRepository,
    private readonly mangaRepo: MangaRepository = mangaRepository,
    private readonly storage: MangaStorageService = storageService,
    private readonly mangadexClient: MangaDexHttpClient = new MangaDexClient()
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

  /**
   * Retrieves a single page binary and MIME type for a chapter.
   * Validates manga, chapter, and page bounds.
   * Handles hosted vs external chapters appropriately.
   */
  public async getPage(
    slug: string,
    chapterNumberParam: string | number,
    pageNumberParam: string | number
  ): Promise<{ data: Buffer; contentType: string }> {
    const trimmedSlug = slug?.trim();
    if (!trimmedSlug) {
      throw AppError.badRequest("Manga slug parameter is required", "INVALID_SLUG");
    }

    // 1. Validate chapter and page numbers
    const parsedChapterNumber = Number(chapterNumberParam);
    if (
      isNaN(parsedChapterNumber) ||
      !Number.isInteger(parsedChapterNumber) ||
      parsedChapterNumber <= 0
    ) {
      throw AppError.badRequest(
        `Invalid chapter number '${chapterNumberParam}'. Chapter number must be a positive integer.`,
        "INVALID_CHAPTER_NUMBER"
      );
    }

    const parsedPageNumber = Number(pageNumberParam);
    if (
      isNaN(parsedPageNumber) ||
      !Number.isInteger(parsedPageNumber) ||
      parsedPageNumber <= 0
    ) {
      throw AppError.badRequest(
        `Invalid page number '${pageNumberParam}'. Page number must be a positive integer.`,
        "INVALID_PAGE_NUMBER"
      );
    }

    // 2. Verify manga exists
    const manga = await this.mangaRepo.findBySlug(trimmedSlug);
    if (!manga) {
      throw AppError.notFound(`Manga '${trimmedSlug}' was not found`, "MANGA_NOT_FOUND");
    }

    // 3. Verify chapter exists and belongs to manga
    const chapter = await this.chapterRepo.findByMangaSlugAndChapterNumber(
      trimmedSlug,
      parsedChapterNumber
    );

    if (!chapter) {
      throw AppError.notFound(
        `Chapter ${parsedChapterNumber} for manga '${trimmedSlug}' was not found`,
        "CHAPTER_NOT_FOUND"
      );
    }

    // 4. Handle External and Unavailable chapter states
    if (chapter.chapterType === "external" || chapter.externalUrl) {
      throw AppError.externalChapter(
        "This chapter is available through an external publisher and does not contain hosted page images.",
        chapter.externalUrl || undefined
      );
    }

    if (chapter.chapterType === "unavailable" || chapter.pageCount === 0) {
      throw new AppError(
        `Chapter ${parsedChapterNumber} is currently unavailable for online reading.`,
        404,
        "SOURCE_CHAPTER_UNAVAILABLE"
      );
    }

    // 5. Validate page number boundary
    if (parsedPageNumber > chapter.pageCount) {
      throw AppError.badRequest(
        `Page ${parsedPageNumber} exceeds total chapter page count of ${chapter.pageCount}`,
        "PAGE_OUT_OF_BOUNDS"
      );
    }

    // 6. Check cache in deterministic storage
    const cachedPage = await this.storage.readPage(
      trimmedSlug,
      parsedChapterNumber,
      parsedPageNumber
    );

    if (cachedPage) {
      return cachedPage;
    }

    // 7. Cache miss: On-demand resolution from source
    if (chapter.source === "mangadex" && chapter.sourceId) {
      const atHome = await this.mangadexClient.getAtHomeServer(chapter.sourceId);
      if (!atHome || !atHome.chapter || !Array.isArray(atHome.chapter.data)) {
        throw new AppError(
          `Unable to resolve @Home server for chapter '${chapter.sourceId}'`,
          502,
          "SOURCE_CHAPTER_UNAVAILABLE"
        );
      }

      if (atHome.chapter.data.length === 0) {
        if (chapter.externalUrl) {
          throw AppError.externalChapter(
            "This chapter is available through an external publisher and does not contain hosted page images.",
            chapter.externalUrl
          );
        }
        throw new AppError(
          "This chapter does not contain hosted pages on the source provider.",
          404,
          "SOURCE_CHAPTER_UNAVAILABLE"
        );
      }

      const pageIndex = parsedPageNumber - 1;
      const filename = atHome.chapter.data[pageIndex];
      if (!filename) {
        throw AppError.notFound(
          `Page ${parsedPageNumber} was not found on source chapter feed`,
          "PAGE_NOT_FOUND"
        );
      }

      const pageUrl = `${atHome.baseUrl}/data/${atHome.chapter.hash}/${filename}`;
      const downloaded = await this.mangadexClient.downloadChapterPage(pageUrl);

      if (!downloaded) {
        throw AppError.notFound(
          `Page image for chapter ${parsedChapterNumber} page ${parsedPageNumber} was not found`,
          "PAGE_IMAGE_NOT_FOUND"
        );
      }

      // Persist to storage cache
      await this.storage.writePage(
        trimmedSlug,
        parsedChapterNumber,
        parsedPageNumber,
        downloaded.buffer,
        downloaded.contentType
      );

      return {
        data: downloaded.buffer,
        contentType: downloaded.contentType
      };
    }

    // 8. Seed / static fallback image resolution
    const fallbackPage = chapter.pages.find((p) => p.pageNumber === parsedPageNumber);
    if (fallbackPage && fallbackPage.imageUrl && fallbackPage.imageUrl.startsWith("http")) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      try {
        const response = await fetch(fallbackPage.imageUrl, { signal: controller.signal });
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const contentType = response.headers.get("content-type") || "image/jpeg";

          await this.storage.writePage(
            trimmedSlug,
            parsedChapterNumber,
            parsedPageNumber,
            buffer,
            contentType
          );

          return { data: buffer, contentType };
        }
      } catch {
        // Fallback fetch failed
      } finally {
        clearTimeout(timer);
      }
    }

    throw AppError.notFound(
      `Page ${parsedPageNumber} for chapter ${parsedChapterNumber} could not be resolved`,
      "PAGE_NOT_FOUND"
    );
  }
}

export const chapterService = new ChapterService();
