/**
 * Interface defining operations for resolving manga asset URLs and storage paths.
 * Completely vendor-agnostic and decoupled from specific cloud storage/CDN providers (S3, R2, GCS, Cloudflare, etc.).
 */

export interface StoredPageResult {
  data: Buffer;
  contentType: string;
}

export interface MangaStorageService {
  /**
   * Generates a deterministic relative storage path for a chapter page.
   * Format: manga/{mangaSlug}/chapters/{chapterNumber}/{paddedPageNumber}.{ext}
   * Example: 'manga/neon-valkyrie/chapters/1/003.webp' or 'manga/solo-leveling/chapters/1/001.jpg'
   */
  getChapterPagePath(
    mangaSlug: string,
    chapterNumber: number,
    pageNumber: number,
    extension?: string
  ): string;

  /**
   * Resolves the public CDN or asset URL for a chapter page.
   * If a CDN base URL is configured, returns the full CDN URL.
   * If not configured and fallbackUrl is provided, returns fallbackUrl.
   * Otherwise returns the Taphem API page delivery endpoint.
   */
  resolveChapterPageUrl(
    mangaSlug: string,
    chapterNumber: number,
    pageNumber: number,
    fallbackUrl?: string
  ): string;

  /**
   * Formats and pads a page number into 3-digit format (e.g. 1 -> '001.webp', 42 -> '042.jpg').
   */
  formatPageFilename(pageNumber: number, extension?: string): string;

  /**
   * Validates and sanitizes a manga slug to prevent path traversal and malformed paths.
   */
  validateSlug(slug: string): string;

  /**
   * Persists binary page image to the underlying storage provider.
   */
  writePage(
    mangaSlug: string,
    chapterNumber: number,
    pageNumber: number,
    data: Buffer,
    contentType: string
  ): Promise<string>;

  /**
   * Reads a binary page image and its MIME content type from storage.
   * Returns null if the page asset is not present in storage.
   */
  readPage(
    mangaSlug: string,
    chapterNumber: number,
    pageNumber: number
  ): Promise<StoredPageResult | null>;

  /**
   * Checks whether a page asset exists in storage.
   */
  hasPage(
    mangaSlug: string,
    chapterNumber: number,
    pageNumber: number
  ): Promise<boolean>;
}
