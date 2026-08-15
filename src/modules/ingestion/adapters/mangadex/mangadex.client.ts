import { config } from "../../../../config/index.js";
import { AppError } from "../../../../utils/errors.js";

/**
 * Raw MangaDex API response shapes.
 */
export interface MangaDexMangaResponse {
  result: "ok" | "error";
  data?: {
    id: string;
    type: "manga";
    attributes: {
      title: Record<string, string>;
      altTitles?: Array<Record<string, string>>;
      description?: Record<string, string>;
      status?: "ongoing" | "completed" | "hiatus" | "cancelled";
      year?: number;
      tags?: Array<{
        id: string;
        attributes: {
          name: Record<string, string>;
          group: string;
        };
      }>;
    };
    relationships?: Array<{
      id: string;
      type: "author" | "artist" | "cover_art";
      attributes?: {
        name?: string;
        fileName?: string;
      };
    }>;
  };
  errors?: Array<{ id: string; status: number; title: string; detail: string }>;
}

export interface MangaDexFeedResponse {
  result: "ok" | "error";
  data?: Array<{
    id: string;
    type: "chapter";
    attributes: {
      chapter: string | null;
      title: string | null;
      pages: number;
      publishAt?: string;
    };
  }>;
  total?: number;
  errors?: Array<{ id: string; status: number; title: string; detail: string }>;
}

export interface MangaDexHttpClient {
  getManga(mangaId: string): Promise<MangaDexMangaResponse | null>;
  getChapterFeed(mangaId: string): Promise<MangaDexFeedResponse>;
}

/**
 * Lightweight HTTP client for interacting with the MangaDex REST API.
 */
export class MangaDexClient implements MangaDexHttpClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(
    baseUrl: string = config.mangadexApiBaseUrl,
    timeoutMs: number = config.mangadexRequestTimeoutMs
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.timeoutMs = timeoutMs;
  }

  private async request<T>(endpoint: string): Promise<T | null> {
    const url = `${this.baseUrl}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "User-Agent": "Taphem-API/1.0.0 (https://api-beta.hemandu.com)"
        },
        signal: controller.signal
      });

      if (response.status === 404) {
        return null;
      }

      if (response.status === 429) {
        throw new AppError(
          "MangaDex API rate limit reached. Please try again later.",
          429,
          "SOURCE_RATE_LIMIT"
        );
      }

      if (!response.ok) {
        throw new AppError(
          `MangaDex API responded with status ${response.status}: ${response.statusText}`,
          response.status >= 500 ? 502 : response.status,
          "SOURCE_API_ERROR"
        );
      }

      return (await response.json()) as T;
    } catch (error: unknown) {
      if (error instanceof AppError) {
        throw error;
      }

      if (error instanceof Error && error.name === "AbortError") {
        throw new AppError(
          `MangaDex API request timed out after ${this.timeoutMs}ms`,
          504,
          "SOURCE_TIMEOUT"
        );
      }

      throw new AppError(
        `Failed to connect to MangaDex API: ${error instanceof Error ? error.message : String(error)}`,
        502,
        "SOURCE_NETWORK_ERROR"
      );
    } finally {
      clearTimeout(timer);
    }
  }

  public async getManga(mangaId: string): Promise<MangaDexMangaResponse | null> {
    const endpoint = `/manga/${encodeURIComponent(mangaId)}?includes[]=cover_art&includes[]=author&includes[]=artist`;
    return this.request<MangaDexMangaResponse>(endpoint);
  }

  public async getChapterFeed(mangaId: string): Promise<MangaDexFeedResponse> {
    const endpoint = `/manga/${encodeURIComponent(mangaId)}/feed?translatedLanguage[]=en&order[chapter]=asc&limit=100`;
    const res = await this.request<MangaDexFeedResponse>(endpoint);
    return res || { result: "ok", data: [] };
  }
}
