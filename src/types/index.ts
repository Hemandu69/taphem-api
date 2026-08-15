/**
 * Standard successful API response envelope.
 */
export interface ApiResponse<T = unknown> {
  success: true;
  data: T;
}

/**
 * Standard error structure embedded inside an error response.
 */
export interface ApiErrorDetail {
  code: string;
  message: string;
  details?: unknown;
}

/**
 * Standard error API response envelope.
 */
export interface ApiErrorResponse {
  success: false;
  error: ApiErrorDetail;
}

// Domain Model Types: Manga
export type {
  Manga,
  MangaStatus,
  MangaRepository
} from "../modules/manga/manga.types.js";

// Domain Model Types: Chapter
export type {
  Chapter,
  ChapterPage,
  ChapterSummary,
  ChapterRepository
} from "../modules/chapter/chapter.types.js";
