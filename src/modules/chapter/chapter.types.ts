/**
 * Single manga chapter page representation.
 * Completely CDN and storage source agnostic.
 */
export interface ChapterPage {
  pageNumber: number;
  imageUrl: string;
}

export type ChapterType = "hosted" | "external" | "unavailable";

/**
 * Summary view of a chapter (omitting full page array for lightweight listings).
 */
export interface ChapterSummary {
  id: string;
  mangaSlug: string;
  chapterNumber: number;
  title: string;
  pageCount: number;
  createdAt?: string;
  source?: string | null;
  sourceId?: string | null;
  externalUrl?: string | null;
  chapterType?: ChapterType;
}

/**
 * Full chapter entity including ordered pages.
 */
export interface Chapter {
  id: string;
  mangaSlug: string;
  chapterNumber: number;
  title: string;
  pageCount: number;
  pages: ChapterPage[];
  createdAt?: string;
  source?: string | null;
  sourceId?: string | null;
  externalUrl?: string | null;
  chapterType?: ChapterType;
}

/**
 * Repository interface abstraction for Chapter data access operations.
 * Allows decoupling business logic from underlying persistence layers (in-memory, SQL, Document).
 */
export interface ChapterRepository {
  findByMangaSlug(mangaSlug: string): Promise<ChapterSummary[]>;
  findByMangaSlugAndChapterNumber(
    mangaSlug: string,
    chapterNumber: number
  ): Promise<Chapter | null>;
}
