import { AppError } from "../../utils/errors.js";
import type { IngestMangaInput, IngestChapterInput } from "./ingestion.types.js";

/**
 * Normalizes a raw string into a clean, URL-safe slug.
 */
export function normalizeSlug(raw: string): string {
  if (!raw || typeof raw !== "string") {
    return "";
  }

  return raw
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "") // remove apostrophes: "demon's" -> "demons"
    .replace(/[^a-z0-9]+/g, "-") // replace non-alphanumeric with single hyphen
    .replace(/^-+|-+$/g, ""); // strip leading/trailing hyphens
}

/**
 * Normalizes a genre name to Title/Canonical Case and produces its deterministic slug.
 * Examples:
 *   "sci-fi" / "SCI-FI" / "sci fi" -> { name: "Sci-Fi", slug: "sci-fi" }
 *   "martial arts" -> { name: "Martial Arts", slug: "martial-arts" }
 */
export function normalizeGenre(rawName: string): { name: string; slug: string } {
  const trimmed = (rawName || "").trim().replace(/\s+/g, " ");
  if (!trimmed) {
    throw AppError.badRequest("Genre name cannot be empty", "INVALID_GENRE_NAME");
  }

  const slug = normalizeSlug(trimmed);
  if (!slug) {
    throw AppError.badRequest(`Invalid genre name '${rawName}'`, "INVALID_GENRE_NAME");
  }

  // Canonical name mapping for common special hyphenated genres
  const canonicalMap: Record<string, string> = {
    "sci-fi": "Sci-Fi",
    "slice-of-life": "Slice of Life",
    "post-apocalyptic": "Post-Apocalyptic"
  };

  if (canonicalMap[slug]) {
    return { name: canonicalMap[slug], slug };
  }

  // Standard Title Case capitalization
  const name = trimmed
    .split(/[\s-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");

  return { name, slug };
}

/**
 * Validates and normalizes raw manga ingestion input.
 */
export function validateAndNormalizeManga(input: IngestMangaInput): IngestMangaInput & { slug: string } {
  if (!input) {
    throw AppError.badRequest("Ingestion manga input is required", "INVALID_INGESTION_INPUT");
  }

  const source = (input.source || "").trim();
  if (!source) {
    throw AppError.badRequest("Source identifier is required", "SOURCE_ID_REQUIRED");
  }

  const sourceId = (input.sourceId || "").trim();
  if (!sourceId) {
    throw AppError.badRequest("Source external ID is required", "SOURCE_ID_REQUIRED");
  }

  const title = (input.title || "").trim();
  if (!title) {
    throw AppError.badRequest("Manga title is required", "INVALID_INGESTION_INPUT");
  }

  const slug = input.slug ? normalizeSlug(input.slug) : normalizeSlug(title);
  if (!slug) {
    throw AppError.badRequest(`Cannot generate valid slug from title '${title}'`, "INVALID_SLUG");
  }

  if (input.rating !== undefined) {
    if (typeof input.rating !== "number" || isNaN(input.rating) || input.rating < 0 || input.rating > 10) {
      throw AppError.badRequest("Rating must be a number between 0 and 10", "INVALID_RATING");
    }
  }

  if (input.releaseYear !== undefined) {
    const currentYear = new Date().getFullYear();
    if (!Number.isInteger(input.releaseYear) || input.releaseYear < 1900 || input.releaseYear > currentYear + 5) {
      throw AppError.badRequest(
        `Release year must be an integer between 1900 and ${currentYear + 5}`,
        "INVALID_RELEASE_YEAR"
      );
    }
  }

  return {
    ...input,
    source,
    sourceId,
    title,
    slug,
    description: (input.description || "").trim(),
    author: (input.author || "Unknown").trim(),
    artist: (input.artist || "Unknown").trim(),
    coverImage: (input.coverImage || "").trim(),
    status: input.status || "ongoing",
    rating: input.rating !== undefined ? Number(input.rating.toFixed(1)) : 0.0,
    releaseYear: input.releaseYear || new Date().getFullYear(),
    alternativeTitles: Array.isArray(input.alternativeTitles)
      ? input.alternativeTitles.map((t) => t.trim()).filter(Boolean)
      : [],
    genres: Array.isArray(input.genres)
      ? input.genres.map((g) => g.trim()).filter(Boolean)
      : []
  };
}

/**
 * Validates and normalizes raw chapter ingestion input.
 */
export function validateAndNormalizeChapter(input: IngestChapterInput): IngestChapterInput {
  if (!input) {
    throw AppError.badRequest("Chapter ingestion input is required", "INVALID_INGESTION_INPUT");
  }

  const source = (input.source || "").trim();
  const sourceId = (input.sourceId || "").trim();
  const mangaSourceId = (input.mangaSourceId || "").trim();

  if (!source || !sourceId || !mangaSourceId) {
    throw AppError.badRequest("Chapter source, sourceId, and mangaSourceId are required", "SOURCE_ID_REQUIRED");
  }

  if (!Number.isInteger(input.chapterNumber) || input.chapterNumber <= 0) {
    throw AppError.badRequest(
      `Invalid chapterNumber '${input.chapterNumber}'. Must be a positive integer >= 1.`,
      "INVALID_CHAPTER_NUMBER"
    );
  }

  if (!Number.isInteger(input.pageCount) || input.pageCount < 0) {
    throw AppError.badRequest(
      `Invalid pageCount '${input.pageCount}'. Must be an integer >= 0.`,
      "INVALID_PAGE_COUNT"
    );
  }

  const externalUrl = input.externalUrl?.trim() || null;
  let chapterType: "hosted" | "external" | "unavailable" = input.chapterType || "hosted";
  if (input.pageCount > 0 && !externalUrl) {
    chapterType = "hosted";
  } else if (externalUrl) {
    chapterType = "external";
  } else if (input.pageCount === 0) {
    chapterType = "unavailable";
  }

  return {
    ...input,
    source,
    sourceId,
    mangaSourceId,
    pageCount: input.pageCount,
    externalUrl,
    chapterType,
    title: (input.title || `Chapter ${input.chapterNumber}`).trim()
  };
}
