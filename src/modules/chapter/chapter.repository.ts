import type {
  Chapter,
  ChapterRepository,
  ChapterSummary
} from "./chapter.types.js";
import { SEED_CHAPTERS } from "./data/chapter.data.js";

/**
 * Static in-memory implementation of the ChapterRepository.
 * Designed to be replaced seamlessly by a database/storage repository without modifying services/controllers.
 */
export class StaticChapterRepository implements ChapterRepository {
  private readonly chapters: Chapter[];

  constructor(initialData: Chapter[] = SEED_CHAPTERS) {
    this.chapters = [...initialData];
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

    // Ensure pages are strictly ordered by pageNumber ascending
    const sortedPages = [...chapter.pages].sort(
      (a, b) => a.pageNumber - b.pageNumber
    );

    return {
      ...chapter,
      pages: sortedPages
    };
  }
}

export const chapterRepository = new StaticChapterRepository();
