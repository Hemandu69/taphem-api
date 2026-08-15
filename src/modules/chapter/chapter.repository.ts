import type {
  Chapter,
  ChapterPage,
  ChapterRepository,
  ChapterSummary
} from "./chapter.types.js";
import { SEED_CHAPTERS } from "./data/chapter.data.js";
import {
  storageService,
  type MangaStorageService
} from "../../infrastructure/storage/index.js";
import { DatabaseChapterRepository } from "./chapter.database.repository.js";
import { isDatabaseConfigured } from "../../infrastructure/database/pool.js";

/**
 * Static in-memory implementation of the ChapterRepository.
 * Useful for standalone testing and fallback operation.
 */
export class StaticChapterRepository implements ChapterRepository {
  private readonly chapters: Chapter[];
  private readonly storage: MangaStorageService;

  constructor(
    initialData: Chapter[] = SEED_CHAPTERS,
    storage: MangaStorageService = storageService
  ) {
    this.chapters = [...initialData];
    this.storage = storage;
  }

  /**
   * Retrieves summary objects of all chapters for a given manga slug, sorted by chapter number.
   */
  public async findByMangaSlug(mangaSlug: string): Promise<ChapterSummary[]> {
    const normalizedSlug = mangaSlug.trim().toLowerCase();

    return this.chapters
      .filter((chap) => chap.mangaSlug.toLowerCase() === normalizedSlug)
      .map(({ id, mangaSlug: slug, chapterNumber, title, pageCount, createdAt }) => ({
        id,
        mangaSlug: slug,
        chapterNumber,
        title,
        pageCount,
        ...(createdAt ? { createdAt } : {})
      }))
      .sort((a, b) => a.chapterNumber - b.chapterNumber);
  }

  /**
   * Retrieves a full chapter with ordered pages for a given manga slug and chapter number.
   * Resolves page image URLs using the storage/CDN abstraction.
   */
  public async findByMangaSlugAndChapterNumber(
    mangaSlug: string,
    chapterNumber: number
  ): Promise<Chapter | null> {
    const normalizedSlug = mangaSlug.trim().toLowerCase();

    const chapter = this.chapters.find(
      (chap) =>
        chap.mangaSlug.toLowerCase() === normalizedSlug &&
        chap.chapterNumber === chapterNumber
    );

    if (!chapter) {
      return null;
    }

    // Ensure pages are strictly ordered by pageNumber ascending and URLs are resolved via storage abstraction
    const sortedPages = [...chapter.pages].sort(
      (a, b) => a.pageNumber - b.pageNumber
    );

    const resolvedPages: ChapterPage[] = sortedPages.map((page) => ({
      pageNumber: page.pageNumber,
      imageUrl: this.storage.resolveChapterPageUrl(
        chapter.mangaSlug,
        chapter.chapterNumber,
        page.pageNumber,
        page.imageUrl
      )
    }));

    return {
      ...chapter,
      pages: resolvedPages
    };
  }
}

export { DatabaseChapterRepository };

/**
 * Default repository instance: uses DatabaseChapterRepository when DATABASE_URL is configured,
 * falling back to StaticChapterRepository.
 */
export const chapterRepository: ChapterRepository = isDatabaseConfigured()
  ? new DatabaseChapterRepository()
  : new StaticChapterRepository();
