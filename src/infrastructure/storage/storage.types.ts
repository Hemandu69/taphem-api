/**
 * Interface defining operations for resolving manga asset URLs and storage paths.
 * Completely vendor-agnostic and decoupled from specific cloud storage/CDN providers (S3, R2, GCS, Cloudflare, etc.).
 */
export interface MangaStorageService {
  /**
   * Generates a deterministic relative storage path for a chapter page.
   * Format: manga/{mangaSlug}/chapters/{chapterNumber}/{paddedPageNumber}.webp
   * Example: 'manga/neon-valkyrie/chapters/1/003.webp'
   */
  getChapterPagePath(
    mangaSlug: string,
    chapterNumber: number,
    pageNumber: number
  ): string;

  /**
   * Resolves the public CDN or asset URL for a chapter page.
   * If a CDN base URL is configured, returns the full CDN URL.
   * If not configured and fallbackUrl is provided, returns fallbackUrl.
   */
  resolveChapterPageUrl(
    mangaSlug: string,
    chapterNumber: number,
    pageNumber: number,
    fallbackUrl?: string
  ): string;

  /**
   * Formats and pads a page number into 3-digit format (e.g. 1 -> '001.webp', 42 -> '042.webp').
   */
  formatPageFilename(pageNumber: number): string;

  /**
   * Validates and sanitizes a manga slug to prevent path traversal and malformed paths.
   */
  validateSlug(slug: string): string;
}
