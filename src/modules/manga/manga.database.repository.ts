import type { Manga, MangaRepository, MangaStatus } from "./manga.types.js";
import { query } from "../../infrastructure/database/pool.js";
import { StaticMangaRepository } from "./manga.repository.js";

interface MangaDbRow {
  id: string;
  slug: string;
  title: string;
  alternative_titles: string[];
  author: string;
  artist: string;
  description: string;
  cover_image: string;
  genres: string[];
  status: string;
  rating: string | number;
  release_year: number;
  chapter_count: number;
}

/**
 * Transforms a raw PostgreSQL row into the strongly typed Manga domain entity.
 */
function mapRowToManga(row: MangaDbRow): Manga {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    alternativeTitles: row.alternative_titles || [],
    author: row.author,
    artist: row.artist,
    description: row.description,
    coverImage: row.cover_image,
    genres: row.genres || [],
    status: row.status as MangaStatus,
    rating:
      typeof row.rating === "string" ? parseFloat(row.rating) : Number(row.rating),
    releaseYear: row.release_year,
    chapterCount: row.chapter_count
  };
}

/**
 * PostgreSQL implementation of the MangaRepository.
 */
export class DatabaseMangaRepository implements MangaRepository {
  private readonly fallback: MangaRepository;

  constructor(fallback: MangaRepository = new StaticMangaRepository()) {
    this.fallback = fallback;
  }

  public async findAll(): Promise<Manga[]> {
    const sql = `
      SELECT
        id,
        slug,
        title,
        alternative_titles,
        author,
        artist,
        description,
        cover_image,
        genres,
        status,
        rating,
        release_year,
        chapter_count
      FROM mangas
      ORDER BY title ASC;
    `;

    try {
      const result = await query<MangaDbRow>(sql);
      return result.rows.map(mapRowToManga);
    } catch (error) {
      console.warn(
        "PostgreSQL query failed, falling back to static in-memory data:",
        error instanceof Error ? error.message : error
      );
      return this.fallback.findAll();
    }
  }

  public async findBySlug(slug: string): Promise<Manga | null> {
    const normalizedSlug = slug.trim().toLowerCase();
    const sql = `
      SELECT
        id,
        slug,
        title,
        alternative_titles,
        author,
        artist,
        description,
        cover_image,
        genres,
        status,
        rating,
        release_year,
        chapter_count
      FROM mangas
      WHERE LOWER(slug) = $1
      LIMIT 1;
    `;

    try {
      const result = await query<MangaDbRow>(sql, [normalizedSlug]);
      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      if (!row) {
        return null;
      }

      return mapRowToManga(row);
    } catch (error) {
      console.warn(
        "PostgreSQL query failed, falling back to static in-memory data:",
        error instanceof Error ? error.message : error
      );
      return this.fallback.findBySlug(slug);
    }
  }
}
