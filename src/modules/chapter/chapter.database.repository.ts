import type {
  Chapter,
  ChapterPage,
  ChapterRepository,
  ChapterSummary
} from "./chapter.types.js";
import { query } from "../../infrastructure/database/pool.js";
import {
  storageService,
  type MangaStorageService
} from "../../infrastructure/storage/index.js";
import { StaticChapterRepository } from "./chapter.repository.js";

interface ChapterSummaryDbRow {
  id: string;
  manga_slug: string;
  chapter_number: number;
  title: string;
  page_count: number;
  created_at: Date | string;
}

interface ChapterPageDbRow {
  page_number: number;
  image_path: string;
}

/**
 * PostgreSQL implementation of the ChapterRepository.
 */
export class DatabaseChapterRepository implements ChapterRepository {
  private readonly storage: MangaStorageService;
  private readonly fallback: ChapterRepository;

  constructor(
    storage: MangaStorageService = storageService,
    fallback: ChapterRepository = new StaticChapterRepository(undefined, storage)
  ) {
    this.storage = storage;
    this.fallback = fallback;
  }

  public async findByMangaSlug(mangaSlug: string): Promise<ChapterSummary[]> {
    const normalizedSlug = mangaSlug.trim().toLowerCase();

    const sql = `
      SELECT
        c.id,
        m.slug AS manga_slug,
        c.chapter_number,
        c.title,
        c.page_count,
        c.created_at
      FROM chapters c
      JOIN mangas m ON m.id = c.manga_id
      WHERE LOWER(m.slug) = $1
      ORDER BY c.chapter_number ASC;
    `;

    try {
      const result = await query<ChapterSummaryDbRow>(sql, [normalizedSlug]);

      return result.rows.map((row) => ({
        id: row.id,
        mangaSlug: row.manga_slug,
        chapterNumber: row.chapter_number,
        title: row.title,
        pageCount: row.page_count,
        createdAt:
          row.created_at instanceof Date
            ? row.created_at.toISOString()
            : String(row.created_at)
      }));
    } catch (error) {
      console.warn(
        "PostgreSQL query failed, falling back to static in-memory data:",
        error instanceof Error ? error.message : error
      );
      return this.fallback.findByMangaSlug(mangaSlug);
    }
  }

  public async findByMangaSlugAndChapterNumber(
    mangaSlug: string,
    chapterNumber: number
  ): Promise<Chapter | null> {
    const normalizedSlug = mangaSlug.trim().toLowerCase();

    const chapterSql = `
      SELECT
        c.id,
        m.slug AS manga_slug,
        c.chapter_number,
        c.title,
        c.page_count,
        c.created_at
      FROM chapters c
      JOIN mangas m ON m.id = c.manga_id
      WHERE LOWER(m.slug) = $1 AND c.chapter_number = $2
      LIMIT 1;
    `;

    try {
      const chapterResult = await query<ChapterSummaryDbRow>(chapterSql, [
        normalizedSlug,
        chapterNumber
      ]);

      if (chapterResult.rows.length === 0) {
        return null;
      }

      const chapterRow = chapterResult.rows[0];
      if (!chapterRow) {
        return null;
      }

      const pagesSql = `
        SELECT
          page_number,
          image_path
        FROM chapter_pages
        WHERE chapter_id = $1
        ORDER BY page_number ASC;
      `;

      const pagesResult = await query<ChapterPageDbRow>(pagesSql, [chapterRow.id]);

      const resolvedPages: ChapterPage[] = pagesResult.rows.map((pageRow) => ({
        pageNumber: pageRow.page_number,
        imageUrl: this.storage.resolveChapterPageUrl(
          chapterRow.manga_slug,
          chapterRow.chapter_number,
          pageRow.page_number,
          pageRow.image_path
        )
      }));

      return {
        id: chapterRow.id,
        mangaSlug: chapterRow.manga_slug,
        chapterNumber: chapterRow.chapter_number,
        title: chapterRow.title,
        pageCount: chapterRow.page_count,
        createdAt:
          chapterRow.created_at instanceof Date
            ? chapterRow.created_at.toISOString()
            : String(chapterRow.created_at),
        pages: resolvedPages
      };
    } catch (error) {
      console.warn(
        "PostgreSQL query failed, falling back to static in-memory data:",
        error instanceof Error ? error.message : error
      );
      return this.fallback.findByMangaSlugAndChapterNumber(
        mangaSlug,
        chapterNumber
      );
    }
  }
}
