import crypto from "node:crypto";
import { getClient, query, isDatabaseConfigured } from "../../infrastructure/database/pool.js";
import type { IngestMangaInput, IngestChapterInput, IngestionAction, IngestionResult } from "./ingestion.types.js";
import { normalizeGenre } from "./ingestion.normalizer.js";

export interface IngestionRepository {
  findMangaBySource(
    source: string,
    sourceId: string
  ): Promise<{ id: string; slug: string } | null>;

  ingestMangaWithChapters(
    mangaInput: IngestMangaInput & { slug: string },
    chaptersInput: IngestChapterInput[]
  ): Promise<IngestionResult>;
}

/**
 * PostgreSQL transactional implementation of IngestionRepository.
 */
export class DatabaseIngestionRepository implements IngestionRepository {
  public async findMangaBySource(
    source: string,
    sourceId: string
  ): Promise<{ id: string; slug: string } | null> {
    const sql = `
      SELECT id, slug
      FROM mangas
      WHERE source = $1 AND source_id = $2
      LIMIT 1;
    `;
    try {
      const res = await query<{ id: string; slug: string }>(sql, [source, sourceId]);
      if (res.rows.length === 0 || !res.rows[0]) {
        return null;
      }
      return {
        id: res.rows[0].id,
        slug: res.rows[0].slug
      };
    } catch (error) {
      console.warn(
        "PostgreSQL query failed in findMangaBySource:",
        error instanceof Error ? error.message : error
      );
      return null;
    }
  }

  public async ingestMangaWithChapters(
    mangaInput: IngestMangaInput & { slug: string },
    chaptersInput: IngestChapterInput[]
  ): Promise<IngestionResult> {
    const client = await getClient();

    try {
      await client.query("BEGIN");

      // 1. Check for existing manga by (source, source_id) OR by slug
      const existingMangaRes = await client.query<{
        id: string;
        slug: string;
        title: string;
        description: string;
        cover_image: string;
        author: string;
        artist: string;
        status: string;
        rating: string | number;
        release_year: number;
      }>(
        `
        SELECT id, slug, title, description, cover_image, author, artist, status, rating, release_year
        FROM mangas
        WHERE (source = $1 AND source_id = $2) OR LOWER(slug) = LOWER($3)
        LIMIT 1;
      `,
        [mangaInput.source, mangaInput.sourceId, mangaInput.slug]
      );

      let mangaId: string;
      let action: IngestionAction = "CREATED";

      if (existingMangaRes.rows.length > 0 && existingMangaRes.rows[0]) {
        const existing = existingMangaRes.rows[0];
        mangaId = existing.id;

        // Check if metadata actually changed
        const hasChanges =
          existing.title !== mangaInput.title ||
          existing.description !== mangaInput.description ||
          existing.cover_image !== mangaInput.coverImage ||
          existing.author !== mangaInput.author ||
          existing.artist !== mangaInput.artist ||
          existing.status !== mangaInput.status ||
          Number(existing.rating) !== Number(mangaInput.rating) ||
          existing.release_year !== mangaInput.releaseYear;

        action = hasChanges ? "UPDATED" : "UNCHANGED";

        await client.query(
          `
          UPDATE mangas SET
            source = $1,
            source_id = $2,
            title = $3,
            alternative_titles = $4,
            author = $5,
            artist = $6,
            description = $7,
            cover_image = $8,
            status = $9,
            rating = $10,
            release_year = $11,
            updated_at = NOW()
          WHERE id = $12;
        `,
          [
            mangaInput.source,
            mangaInput.sourceId,
            mangaInput.title,
            mangaInput.alternativeTitles || [],
            mangaInput.author || "Unknown",
            mangaInput.artist || "Unknown",
            mangaInput.description || "",
            mangaInput.coverImage || "",
            mangaInput.status || "ongoing",
            mangaInput.rating || 0.0,
            mangaInput.releaseYear || new Date().getFullYear(),
            mangaId
          ]
        );
      } else {
        mangaId = `manga_${crypto.randomBytes(10).toString("hex")}`;
        action = "CREATED";

        await client.query(
          `
          INSERT INTO mangas (
            id, source, source_id, slug, title, alternative_titles, author, artist,
            description, cover_image, status, rating, release_year, chapter_count, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW());
        `,
          [
            mangaId,
            mangaInput.source,
            mangaInput.sourceId,
            mangaInput.slug,
            mangaInput.title,
            mangaInput.alternativeTitles || [],
            mangaInput.author || "Unknown",
            mangaInput.artist || "Unknown",
            mangaInput.description || "",
            mangaInput.coverImage || "",
            mangaInput.status || "ongoing",
            mangaInput.rating || 0.0,
            mangaInput.releaseYear || new Date().getFullYear(),
            chaptersInput.length
          ]
        );
      }

      // 2. Synchronize Normalized Genres
      const normalizedGenres = (mangaInput.genres || []).map((g) => normalizeGenre(g));
      const genreIds: number[] = [];

      for (const genre of normalizedGenres) {
        const genreRes = await client.query<{ id: number }>(
          `
          INSERT INTO genres (slug, name)
          VALUES ($1, $2)
          ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
          RETURNING id;
        `,
          [genre.slug, genre.name]
        );

        if (genreRes.rows[0]) {
          genreIds.push(genreRes.rows[0].id);
        }
      }

      // Link manga to genres (idempotent)
      for (const genreId of genreIds) {
        await client.query(
          `
          INSERT INTO manga_genres (manga_id, genre_id)
          VALUES ($1, $2)
          ON CONFLICT (manga_id, genre_id) DO NOTHING;
        `,
          [mangaId, genreId]
        );
      }

      // 3. Upsert Chapters
      for (const chap of chaptersInput) {
        const chapterId = `chap_${mangaInput.slug.slice(0, 8)}_${chap.chapterNumber}_${crypto
          .randomBytes(4)
          .toString("hex")}`;

        await client.query(
          `
          INSERT INTO chapters (
            id, manga_id, source, source_id, chapter_number, title, page_count, external_url, chapter_type, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
          ON CONFLICT (manga_id, chapter_number) DO UPDATE SET
            source = EXCLUDED.source,
            source_id = EXCLUDED.source_id,
            title = EXCLUDED.title,
            page_count = EXCLUDED.page_count,
            external_url = EXCLUDED.external_url,
            chapter_type = EXCLUDED.chapter_type,
            updated_at = NOW();
        `,
          [
            chapterId,
            mangaId,
            chap.source,
            chap.sourceId,
            chap.chapterNumber,
            chap.title || `Chapter ${chap.chapterNumber}`,
            chap.pageCount,
            chap.externalUrl || null,
            chap.chapterType || (chap.externalUrl ? "external" : chap.pageCount > 0 ? "hosted" : "unavailable")
          ]
        );
      }

      // Update total chapter count on manga
      const countRes = await client.query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM chapters WHERE manga_id = $1",
        [mangaId]
      );
      const totalChapters = countRes.rows[0] ? parseInt(countRes.rows[0].count, 10) : chaptersInput.length;

      await client.query(
        "UPDATE mangas SET chapter_count = $1, updated_at = NOW() WHERE id = $2",
        [totalChapters, mangaId]
      );

      await client.query("COMMIT");

      return {
        action,
        source: mangaInput.source,
        sourceId: mangaInput.sourceId,
        mangaId,
        slug: mangaInput.slug,
        title: mangaInput.title,
        chaptersCount: totalChapters,
        genresCount: genreIds.length
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

/**
 * In-memory implementation of IngestionRepository for testing and offline development.
 */
export class StaticIngestionRepository implements IngestionRepository {
  private readonly memoryManga = new Map<string, IngestMangaInput & { id: string; slug: string }>();
  private readonly memoryChapters = new Map<string, IngestChapterInput[]>();

  public async findMangaBySource(
    source: string,
    sourceId: string
  ): Promise<{ id: string; slug: string } | null> {
    const key = `${source}:${sourceId}`;
    const existing = this.memoryManga.get(key);
    if (!existing) {
      return null;
    }
    return {
      id: existing.id,
      slug: existing.slug
    };
  }

  public async ingestMangaWithChapters(
    mangaInput: IngestMangaInput & { slug: string },
    chaptersInput: IngestChapterInput[]
  ): Promise<IngestionResult> {
    const key = `${mangaInput.source}:${mangaInput.sourceId}`;
    const existing = this.memoryManga.get(key) || this.memoryManga.get(mangaInput.slug);

    let action: IngestionAction = "CREATED";
    let mangaId: string;

    if (existing) {
      mangaId = existing.id;
      const changed =
        existing.title !== mangaInput.title ||
        existing.description !== mangaInput.description ||
        existing.rating !== mangaInput.rating;
      action = changed ? "UPDATED" : "UNCHANGED";
      this.memoryManga.set(key, { ...mangaInput, id: mangaId });
    } else {
      mangaId = `manga_mem_${crypto.randomBytes(6).toString("hex")}`;
      action = "CREATED";
      this.memoryManga.set(key, { ...mangaInput, id: mangaId });
      this.memoryManga.set(mangaInput.slug, { ...mangaInput, id: mangaId });
    }

    // Upsert chapters
    const existingChaps = this.memoryChapters.get(mangaId) || [];
    const chapterMap = new Map<number, IngestChapterInput>();
    for (const c of existingChaps) {
      chapterMap.set(c.chapterNumber, c);
    }
    for (const c of chaptersInput) {
      chapterMap.set(c.chapterNumber, c);
    }
    this.memoryChapters.set(mangaId, Array.from(chapterMap.values()));

    return {
      action,
      source: mangaInput.source,
      sourceId: mangaInput.sourceId,
      mangaId,
      slug: mangaInput.slug,
      title: mangaInput.title,
      chaptersCount: chapterMap.size,
      genresCount: (mangaInput.genres || []).length
    };
  }

  public getChapters(mangaIdOrSlug: string): IngestChapterInput[] {
    const existing = this.memoryManga.get(mangaIdOrSlug);
    const mangaId = existing ? existing.id : mangaIdOrSlug;
    return this.memoryChapters.get(mangaId) || [];
  }
}

/**
 * Ingestion repository selector based on database configuration.
 */
export const ingestionRepository: IngestionRepository = isDatabaseConfigured()
  ? new DatabaseIngestionRepository()
  : new StaticIngestionRepository();
