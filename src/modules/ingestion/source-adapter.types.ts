import type { MangaStatus } from "../manga/manga.types.js";

/**
 * Metadata describing an external manga content source.
 */
export interface SourceMetadata {
  id: string;
  name: string;
  baseUrl?: string;
}

/**
 * Raw normalized manga metadata emitted by an external source adapter.
 */
export interface SourceMangaPayload {
  sourceId: string;
  title: string;
  slug?: string;
  alternativeTitles?: string[];
  author?: string;
  artist?: string;
  description?: string;
  coverImage?: string;
  genres?: string[];
  status?: MangaStatus;
  rating?: number;
  releaseYear?: number;
}

/**
 * Raw normalized chapter metadata emitted by an external source adapter.
 */
export interface SourceChapterPayload {
  sourceId: string;
  mangaSourceId: string;
  chapterNumber: number;
  title?: string;
  pageCount: number;
}

/**
 * Options passed to source search queries.
 */
export interface SourceSearchOptions {
  page?: number;
  limit?: number;
  offset?: number;
}

/**
 * Single normalized item returned in external source search results.
 */
export interface SourceMangaSearchItem {
  source: string;
  sourceId: string;
  slug: string;
  title: string;
  alternativeTitles?: string[];
  author?: string;
  artist?: string;
  description?: string;
  coverImage?: string;
  genres?: string[];
  status?: MangaStatus;
  rating?: number;
  releaseYear?: number;
}

/**
 * Pagination metadata for search results.
 */
export interface SourceSearchPagination {
  page: number;
  limit: number;
  total: number;
  hasNextPage: boolean;
}

/**
 * Source-agnostic paginated search results structure.
 */
export interface SourceSearchResult {
  source: string;
  query: string;
  items: SourceMangaSearchItem[];
  pagination: SourceSearchPagination;
}

/**
 * Normalized payload returned when fetching full source manga details.
 */
export interface SourceMangaDetailsPayload {
  source: string;
  sourceId: string;
  slug: string;
  title: string;
  alternativeTitles?: string[];
  author?: string;
  artist?: string;
  description?: string;
  coverImage?: string;
  genres?: string[];
  status?: MangaStatus;
  rating?: number | null;
  releaseYear?: number;
  chapters: SourceChapterPayload[];
  ingested: boolean;
  mangaId: string | null;
  mangaSlug: string | null;
}

/**
 * Contract implemented by all external source adapters.
 * Designed so new source providers can be plugged in without changing the core ingestion pipeline.
 */
export interface MangaSourceAdapter {
  readonly sourceId: string;
  readonly sourceName: string;

  /**
   * Fetches manga metadata for a given external identifier.
   */
  fetchManga(externalId: string): Promise<SourceMangaPayload | null>;

  /**
   * Fetches chapter metadata list for a given external manga identifier.
   */
  fetchChapters(externalId: string): Promise<SourceChapterPayload[]>;

  /**
   * Optional method to fetch complete manga details and chapters.
   */
  fetchMangaDetails?(externalId: string): Promise<{
    manga: SourceMangaPayload;
    chapters: SourceChapterPayload[];
  } | null>;

  /**
   * Optional search capability across the external source catalog.
   */
  searchManga?(
    query: string,
    options?: SourceSearchOptions
  ): Promise<SourceSearchResult>;
}

