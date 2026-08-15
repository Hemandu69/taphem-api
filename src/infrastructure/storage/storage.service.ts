import { config } from "../../config/index.js";
import { AppError } from "../../utils/errors.js";
import type { MangaStorageService } from "./storage.types.js";

/**
 * Vendor-agnostic storage service implementation for resolving manga asset URLs and paths.
 */
export class StorageService implements MangaStorageService {
  private readonly cdnBaseUrl: string;

  constructor(cdnBaseUrl: string = config.mangaCdnBaseUrl) {
    // Normalize CDN base URL by trimming and stripping trailing slashes
    this.cdnBaseUrl = cdnBaseUrl ? cdnBaseUrl.trim().replace(/\/+$/, "") : "";
  }

  /**
   * Formats a page number into a normalized 3-digit webp filename (e.g. 1 -> '001.webp', 42 -> '042.webp').
   */
  public formatPageFilename(pageNumber: number): string {
    this.validatePositiveInteger(pageNumber, "pageNumber");
    const padded = String(pageNumber).padStart(3, "0");
    return `${padded}.webp`;
  }

  /**
   * Validates and sanitizes a manga slug to prevent path traversal and malformed paths.
   */
  public validateSlug(slug: string): string {
    const trimmed = slug?.trim();
    if (!trimmed) {
      throw AppError.badRequest("Manga slug is required", "INVALID_SLUG");
    }

    // Slug must contain only lowercase alphanumeric characters separated by single hyphens
    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    if (
      !slugRegex.test(trimmed) ||
      trimmed.includes("..") ||
      trimmed.includes("/") ||
      trimmed.includes("\\") ||
      trimmed.toLowerCase().includes("%2e")
    ) {
      throw AppError.badRequest(`Invalid manga slug '${slug}'`, "INVALID_SLUG");
    }

    return trimmed;
  }

  /**
   * Validates that a numeric parameter is a positive integer.
   */
  private validatePositiveInteger(value: number, fieldName: string): number {
    if (
      typeof value !== "number" ||
      isNaN(value) ||
      !Number.isInteger(value) ||
      value <= 0
    ) {
      throw AppError.badRequest(
        `Invalid ${fieldName} '${value}'. Must be a positive integer.`,
        `INVALID_${fieldName.toUpperCase()}`
      );
    }
    return value;
  }

  /**
   * Generates the canonical relative storage path for a chapter page.
   * Format: manga/{mangaSlug}/chapters/{chapterNumber}/{paddedPageNumber}.webp
   */
  public getChapterPagePath(
    mangaSlug: string,
    chapterNumber: number,
    pageNumber: number
  ): string {
    const validSlug = this.validateSlug(mangaSlug);
    const validChapter = this.validatePositiveInteger(
      chapterNumber,
      "chapterNumber"
    );
    const filename = this.formatPageFilename(pageNumber);

    return `manga/${validSlug}/chapters/${validChapter}/${filename}`;
  }

  /**
   * Resolves the public URL for a chapter page.
   * Uses CDN base URL when configured, otherwise falls back to the provided fallback URL or relative path.
   */
  public resolveChapterPageUrl(
    mangaSlug: string,
    chapterNumber: number,
    pageNumber: number,
    fallbackUrl?: string
  ): string {
    const relativePath = this.getChapterPagePath(
      mangaSlug,
      chapterNumber,
      pageNumber
    );

    if (this.cdnBaseUrl) {
      return `${this.cdnBaseUrl}/${relativePath}`;
    }

    // If no CDN is configured and a fallback/seed URL is provided, preserve fallback
    if (fallbackUrl && fallbackUrl.trim().length > 0) {
      return fallbackUrl.trim();
    }

    return `/${relativePath}`;
  }
}

export const storageService = new StorageService();
