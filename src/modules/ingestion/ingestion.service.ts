import { AppError } from "../../utils/errors.js";
import type {
  MangaSourceAdapter,
  SourceMangaPayload,
  SourceChapterPayload,
  SourceMangaDetailsPayload
} from "./source-adapter.types.js";
import type { IngestMangaInput, IngestChapterInput, IngestionResult } from "./ingestion.types.js";
import {
  validateAndNormalizeManga,
  validateAndNormalizeChapter,
  normalizeSlug
} from "./ingestion.normalizer.js";
import { ingestionRepository, type IngestionRepository } from "./ingestion.repository.js";

/**
 * IngestionService coordinates source adapters, data normalization, and transactional database persistence.
 */
export class IngestionService {
  private readonly repository: IngestionRepository;

  constructor(repository: IngestionRepository = ingestionRepository) {
    this.repository = repository;
  }

  /**
   * Retrieves complete source manga details and chapters annotated with Taphem ingestion status.
   * Completely READ-ONLY (zero database mutations).
   */
  public async getSourceMangaDetails(
    adapter: MangaSourceAdapter,
    externalId: string
  ): Promise<SourceMangaDetailsPayload> {
    if (!adapter) {
      throw AppError.badRequest("MangaSourceAdapter instance is required", "INVALID_SOURCE_INPUT");
    }

    const cleanExternalId = (externalId || "").trim();
    if (!cleanExternalId) {
      throw AppError.badRequest("External source ID is required", "SOURCE_ID_REQUIRED");
    }

    let mangaPayload: SourceMangaPayload | null = null;
    let chapterPayloads: SourceChapterPayload[] = [];

    if (typeof adapter.fetchMangaDetails === "function") {
      const details = await adapter.fetchMangaDetails(cleanExternalId);
      if (details) {
        mangaPayload = details.manga;
        chapterPayloads = details.chapters;
      }
    } else {
      mangaPayload = await adapter.fetchManga(cleanExternalId);
      if (mangaPayload) {
        chapterPayloads = await adapter.fetchChapters(cleanExternalId);
      }
    }

    if (!mangaPayload) {
      throw AppError.notFound(
        `Manga '${cleanExternalId}' was not found on source '${adapter.sourceName}'`,
        "MANGA_SOURCE_NOT_FOUND"
      );
    }

    // Sort chapters ascending by chapter number
    const sortedChapters = [...chapterPayloads].sort(
      (a, b) => a.chapterNumber - b.chapterNumber
    );

    // Read-only catalog lookup for ingestion status
    const existing = await this.repository.findMangaBySource(
      adapter.sourceId,
      mangaPayload.sourceId
    );

    return {
      source: adapter.sourceId,
      sourceId: mangaPayload.sourceId,
      slug: mangaPayload.slug || normalizeSlug(mangaPayload.title),
      title: mangaPayload.title,
      alternativeTitles: mangaPayload.alternativeTitles || [],
      author: mangaPayload.author || "Unknown",
      artist: mangaPayload.artist || mangaPayload.author || "Unknown",
      description: mangaPayload.description || "",
      coverImage: mangaPayload.coverImage || "",
      genres: mangaPayload.genres || [],
      status: mangaPayload.status || "ongoing",
      rating: mangaPayload.rating ?? null,
      releaseYear: mangaPayload.releaseYear,
      chapters: sortedChapters,
      ingested: Boolean(existing),
      mangaId: existing ? existing.id : null,
      mangaSlug: existing ? existing.slug : null
    };
  }

  /**
   * Ingests a manga and its chapters from any compliant MangaSourceAdapter.
   */
  public async ingestFromAdapter(
    adapter: MangaSourceAdapter,
    externalId: string
  ): Promise<IngestionResult> {
    if (!adapter) {
      throw AppError.badRequest("MangaSourceAdapter instance is required", "INVALID_INGESTION_INPUT");
    }

    const cleanExternalId = (externalId || "").trim();
    if (!cleanExternalId) {
      throw AppError.badRequest("External source ID is required", "SOURCE_ID_REQUIRED");
    }

    // 1. Fetch raw payload from adapter
    const mangaPayload = await adapter.fetchManga(cleanExternalId);
    if (!mangaPayload) {
      throw AppError.notFound(
        `Manga '${cleanExternalId}' was not found on source '${adapter.sourceName}'`,
        "MANGA_SOURCE_NOT_FOUND"
      );
    }

    const chapterPayloads = await adapter.fetchChapters(cleanExternalId);

    // 2. Map payload to normalized input DTOs
    const mangaInput: IngestMangaInput = {
      source: adapter.sourceId,
      sourceId: mangaPayload.sourceId,
      slug: mangaPayload.slug,
      title: mangaPayload.title,
      alternativeTitles: mangaPayload.alternativeTitles,
      author: mangaPayload.author,
      artist: mangaPayload.artist,
      description: mangaPayload.description,
      coverImage: mangaPayload.coverImage,
      genres: mangaPayload.genres,
      status: mangaPayload.status,
      rating: mangaPayload.rating,
      releaseYear: mangaPayload.releaseYear
    };

    const chaptersInput: IngestChapterInput[] = chapterPayloads.map((c) => ({
      source: adapter.sourceId,
      sourceId: c.sourceId,
      mangaSourceId: c.mangaSourceId,
      chapterNumber: c.chapterNumber,
      title: c.title,
      pageCount: c.pageCount
    }));

    return this.ingestManga(mangaInput, chaptersInput);
  }

  /**
   * Directly ingests normalized manga and chapters with full validation and transactional persistence.
   */
  public async ingestManga(
    mangaInput: IngestMangaInput,
    chaptersInput: IngestChapterInput[] = []
  ): Promise<IngestionResult> {
    // 1. Validate & normalize manga metadata
    const normalizedManga = validateAndNormalizeManga(mangaInput);

    // 2. Validate & normalize chapters
    const normalizedChapters = chaptersInput.map((c) => validateAndNormalizeChapter(c));

    // Ensure chapter numbers within the payload are unique
    const seenChapterNumbers = new Set<number>();
    for (const c of normalizedChapters) {
      if (seenChapterNumbers.has(c.chapterNumber)) {
        throw AppError.badRequest(
          `Duplicate chapter number '${c.chapterNumber}' in ingestion payload`,
          "DUPLICATE_SOURCE_RECORD"
        );
      }
      seenChapterNumbers.add(c.chapterNumber);
    }

    // 3. Persist atomically through repository
    return this.repository.ingestMangaWithChapters(normalizedManga, normalizedChapters);
  }
}

export const ingestionService = new IngestionService();
