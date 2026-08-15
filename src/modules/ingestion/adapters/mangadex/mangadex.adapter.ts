import type {
  MangaSourceAdapter,
  SourceMangaPayload,
  SourceChapterPayload,
  SourceSearchOptions,
  SourceSearchResult
} from "../../source-adapter.types.js";
import { MangaDexClient, type MangaDexHttpClient } from "./mangadex.client.js";
import { MangaDexMapper } from "./mangadex.mapper.js";

/**
 * Real source adapter for MangaDex (https://api.mangadex.org).
 * Fetches and transforms MangaDex manga, chapter metadata, and search results into normalized DTOs.
 */
export class MangaDexAdapter implements MangaSourceAdapter {
  public readonly sourceId = "mangadex";
  public readonly sourceName = "MangaDex";

  private readonly client: MangaDexHttpClient;

  constructor(client: MangaDexHttpClient = new MangaDexClient()) {
    this.client = client;
  }

  /**
   * Fetches and maps manga metadata from MangaDex.
   */
  public async fetchManga(externalId: string): Promise<SourceMangaPayload | null> {
    const rawData = await this.client.getManga(externalId);
    if (!rawData) {
      return null;
    }
    return MangaDexMapper.mapManga(rawData);
  }

  /**
   * Fetches, deduplicates, and orders chapters from MangaDex.
   */
  public async fetchChapters(externalId: string): Promise<SourceChapterPayload[]> {
    const feed = await this.client.getChapterFeed(externalId);
    return MangaDexMapper.mapChapters(externalId, feed);
  }

  /**
   * Searches MangaDex catalog by query title with pagination.
   */
  public async searchManga(
    query: string,
    options?: SourceSearchOptions
  ): Promise<SourceSearchResult> {
    const page = Math.max(options?.page || 1, 1);
    const limit = Math.min(Math.max(options?.limit || 20, 1), 100);
    const offset =
      typeof options?.offset === "number" ? options.offset : (page - 1) * limit;

    const rawData = await this.client.searchManga({
      title: query,
      limit,
      offset
    });

    return MangaDexMapper.mapSearch(query, rawData, page, limit);
  }
}
