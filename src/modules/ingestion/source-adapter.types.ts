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
}
