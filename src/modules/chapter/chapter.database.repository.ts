import type {
  Chapter,
  ChapterPage,
  ChapterRepository,
  ChapterSummary,
  ChapterType
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
  source?: string | null;
  source_id?: string | null;
  external_url?: string | null;
  chapter_type?: ChapterType | null;
}

/**
 * PostgreSQL implementation of the ChapterRepository.
 * Uses deterministic MangaStorageService to construct chapter page assets
 * directly from page_count, without requiring per-page database rows.
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
        c.created_at,
        c.source,
        c.source_id,
        c.external_url,
        c.chapter_type
      FROM chapters c
      JOIN mangas m ON m.id = c.manga_id
      WHERE LOWER(m.slug) = $1
      ORDER BY c.chapter_number ASC;
    `;

    try {
      const result = await query<ChapterSummaryDbRow>(sql, [normalizedSlug]);

      return result.rows.map((row) => {
        const extUrl = row.external_url || null;
        let cType: ChapterType = row.chapter_type || "hosted";
        if (extUrl) {
          cType = "external";
        } else if (row.page_count === 0) {
          cType = "unavailable";
        }

        return {
          id: row.id,
          mangaSlug: row.manga_slug,
          chapterNumber: row.chapter_number,
          title: row.title,
          pageCount: row.page_count,
          createdAt:
            row.created_at instanceof Date
              ? row.created_at.toISOString()
              : String(row.created_at),
          source: row.source || null,
          sourceId: row.source_id || null,
          externalUrl: extUrl,
          chapterType: cType
        };
      });
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
        c.created_at,
        c.source,
        c.source_id,
        c.external_url,
        c.chapter_type
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

      const extUrl = chapterRow.external_url || null;
      let cType: ChapterType = chapterRow.chapter_type || "hosted";
      if (extUrl) {
        cType = "external";
      } else if (chapterRow.page_count === 0) {
        cType = "unavailable";
      }

      // Generate deterministic pages directly from chapter page_count if hosted
      const resolvedPages: ChapterPage[] =
        cType === "hosted" && chapterRow.page_count > 0
          ? Array.from({ length: chapterRow.page_count }, (_, idx) => {
              const pageNumber = idx + 1;
              return {
                pageNumber,
                imageUrl: this.storage.resolveChapterPageUrl(
                  chapterRow.manga_slug,
                  chapterRow.chapter_number,
                  pageNumber
                )
              };
            })
          : [];

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
        source: chapterRow.source || null,
        sourceId: chapterRow.source_id || null,
        externalUrl: extUrl,
        chapterType: cType,
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
