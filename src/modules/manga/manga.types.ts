/**
 * Manga status union type.
 */
export type MangaStatus = "ongoing" | "completed" | "hiatus";

/**
 * Core Manga domain model entity.
 */
export interface Manga {
  id: string;
  slug: string;
  title: string;
  alternativeTitles: string[];
  author: string;
  artist: string;
  description: string;
  coverImage: string;
  genres: string[];
  status: MangaStatus;
  rating: number;
  releaseYear: number;
  chapterCount: number;
}

/**
 * Repository interface abstraction for Manga data access operations.
 * Allows decoupling business logic from the underlying storage mechanism.
 */
export interface MangaRepository {
  findAll(): Promise<Manga[]>;
  findBySlug(slug: string): Promise<Manga | null>;
}
