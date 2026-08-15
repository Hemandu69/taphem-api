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
    genres: Array.isArray(row.genres) ? row.genres : [],
    status: row.status as MangaStatus,
    rating:
      typeof row.rating === "string" ? parseFloat(row.rating) : Number(row.rating),
    releaseYear: row.release_year,
    chapterCount: row.chapter_count
  };
}

/**
 * PostgreSQL implementation of the MangaRepository querying normalized manga & genre tables.
 */
export class DatabaseMangaRepository implements MangaRepository {
  private readonly fallback: MangaRepository;

  constructor(fallback: MangaRepository = new StaticMangaRepository()) {
    this.fallback = fallback;
  }

  public async findAll(): Promise<Manga[]> {
    const sql = `
      SELECT
        m.id,
        m.slug,
        m.title,
        m.alternative_titles,
        m.author,
        m.artist,
        m.description,
        m.cover_image,
        COALESCE(
          array_agg(g.name ORDER BY g.name ASC) FILTER (WHERE g.name IS NOT NULL),
          '{}'
        ) AS genres,
        m.status,
        m.rating,
        m.release_year,
        m.chapter_count
      FROM mangas m
      LEFT JOIN manga_genres mg ON mg.manga_id = m.id
      LEFT JOIN genres g ON g.id = mg.genre_id
      GROUP BY m.id
      ORDER BY m.title ASC;
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
        m.id,
        m.slug,
        m.title,
        m.alternative_titles,
        m.author,
        m.artist,
        m.description,
        m.cover_image,
        COALESCE(
          array_agg(g.name ORDER BY g.name ASC) FILTER (WHERE g.name IS NOT NULL),
          '{}'
        ) AS genres,
        m.status,
        m.rating,
        m.release_year,
        m.chapter_count
      FROM mangas m
      LEFT JOIN manga_genres mg ON mg.manga_id = m.id
      LEFT JOIN genres g ON g.id = mg.genre_id
      WHERE LOWER(m.slug) = $1
      GROUP BY m.id
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
