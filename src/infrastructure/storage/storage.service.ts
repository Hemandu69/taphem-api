import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../../config/index.js";
import { AppError } from "../../utils/errors.js";
import type { MangaStorageService, StoredPageResult } from "./storage.types.js";

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif"
};

const EXT_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif"
};

/**
 * Vendor-agnostic storage service implementation for resolving manga asset URLs,
 * storage paths, and managing on-demand binary caching.
 */
export class StorageService implements MangaStorageService {
  private readonly cdnBaseUrl: string;
  private readonly storageDir: string;

  constructor(
    cdnBaseUrl: string = config.mangaCdnBaseUrl,
    storageDir: string = path.resolve(process.cwd(), ".storage")
  ) {
    // Normalize CDN base URL by trimming and stripping trailing slashes
    this.cdnBaseUrl = cdnBaseUrl ? cdnBaseUrl.trim().replace(/\/+$/, "") : "";
    this.storageDir = storageDir;
  }

  /**
   * Formats a page number into a normalized 3-digit filename with matching extension (e.g. 1 -> '001.webp' or '001.jpg').
   */
  public formatPageFilename(pageNumber: number, extension: string = "webp"): string {
    this.validatePositiveInteger(pageNumber, "pageNumber");
    const padded = String(pageNumber).padStart(3, "0");
    const cleanExt = extension.replace(/^\.+/, "").toLowerCase() || "webp";
    return `${padded}.${cleanExt}`;
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
   * Format: manga/{mangaSlug}/chapters/{chapterNumber}/{paddedPageNumber}.{ext}
   */
  public getChapterPagePath(
    mangaSlug: string,
    chapterNumber: number,
    pageNumber: number,
    extension: string = "webp"
  ): string {
    const validSlug = this.validateSlug(mangaSlug);
    const validChapter = this.validatePositiveInteger(
      chapterNumber,
      "chapterNumber"
    );
    const filename = this.formatPageFilename(pageNumber, extension);

    return `manga/${validSlug}/chapters/${validChapter}/${filename}`;
  }

  /**
   * Resolves the public URL for a chapter page.
   * - If a CDN base URL is configured, returns the full CDN asset URL.
   * - If no CDN is configured and a fallback/seed URL is provided, returns fallbackUrl.
   * - If no CDN is configured, returns the Taphem API on-demand asset delivery endpoint.
   */
  public resolveChapterPageUrl(
    mangaSlug: string,
    chapterNumber: number,
    pageNumber: number,
    fallbackUrl?: string
  ): string {
    const validSlug = this.validateSlug(mangaSlug);
    const validChapter = this.validatePositiveInteger(
      chapterNumber,
      "chapterNumber"
    );
    this.validatePositiveInteger(pageNumber, "pageNumber");

    if (this.cdnBaseUrl) {
      const relativePath = this.getChapterPagePath(
        validSlug,
        validChapter,
        pageNumber,
        "webp"
      );
      return `${this.cdnBaseUrl}/${relativePath}`;
    }

    // If no CDN is configured and a fallback/seed URL is provided, preserve fallback
    if (fallbackUrl && fallbackUrl.trim().length > 0) {
      return fallbackUrl.trim();
    }

    // Default to the Taphem API on-demand page streaming endpoint
    return `/api/v1/manga/${validSlug}/chapters/${validChapter}/pages/${pageNumber}`;
  }

  /**
   * Persists binary page data to disk storage with true file extension derived from MIME type.
   */
  public async writePage(
    mangaSlug: string,
    chapterNumber: number,
    pageNumber: number,
    data: Buffer,
    contentType: string
  ): Promise<string> {
    const cleanMime = contentType.split(";")[0]?.trim().toLowerCase() || "image/jpeg";
    const ext = MIME_TO_EXT[cleanMime] || "jpg";
    const relativePath = this.getChapterPagePath(mangaSlug, chapterNumber, pageNumber, ext);
    const fullPath = path.join(this.storageDir, relativePath);

    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, data);

    return relativePath;
  }

  /**
   * Reads a binary page image from disk storage.
   * Checks for all supported image extensions for the specified page number.
   */
  public async readPage(
    mangaSlug: string,
    chapterNumber: number,
    pageNumber: number
  ): Promise<StoredPageResult | null> {
    const validSlug = this.validateSlug(mangaSlug);
    const validChapter = this.validatePositiveInteger(chapterNumber, "chapterNumber");
    const padded = String(pageNumber).padStart(3, "0");
    const chapterDir = path.join(this.storageDir, "manga", validSlug, "chapters", String(validChapter));

    try {
      const files = await fs.readdir(chapterDir);
      const matchingFile = files.find((f) => f.startsWith(`${padded}.`));

      if (!matchingFile) {
        return null;
      }

      const filePath = path.join(chapterDir, matchingFile);
      const ext = path.extname(matchingFile).replace(/^\.+/, "").toLowerCase();
      const contentType = EXT_TO_MIME[ext] || "image/jpeg";
      const data = await fs.readFile(filePath);

      return { data, contentType };
    } catch {
      // Directory or file does not exist
      return null;
    }
  }

  /**
   * Checks whether a page asset is present in disk storage.
   */
  public async hasPage(
    mangaSlug: string,
    chapterNumber: number,
    pageNumber: number
  ): Promise<boolean> {
    const result = await this.readPage(mangaSlug, chapterNumber, pageNumber);
    return result !== null;
  }
}

export const storageService = new StorageService();
