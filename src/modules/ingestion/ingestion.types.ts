import type { MangaStatus } from "../manga/manga.types.js";

/**
 * Normalized input structure for ingesting or updating a manga record.
 */
export interface IngestMangaInput {
  source: string;
  sourceId: string;
  slug?: string;
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
 * Normalized input structure for ingesting a single chapter.
 */
export interface IngestChapterInput {
  source: string;
  sourceId: string;
  mangaSourceId: string;
  chapterNumber: number;
  title?: string;
  pageCount: number;
}

/**
 * Action taken during ingestion.
 */
export type IngestionAction = "CREATED" | "UPDATED" | "UNCHANGED";

/**
 * Ingestion summary result for a manga and its associated chapters.
 */
export interface IngestionResult {
  action: IngestionAction;
  source: string;
  sourceId: string;
  mangaId: string;
  slug: string;
  title: string;
  chaptersCount: number;
  genresCount: number;
}

