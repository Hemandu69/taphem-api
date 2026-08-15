import type {
  SourceMangaPayload,
  SourceChapterPayload,
  SourceSearchResult,
  SourceMangaSearchItem
} from "../../source-adapter.types.js";
import type { MangaStatus } from "../../../manga/manga.types.js";
import type {
  MangaDexMangaResponse,
  MangaDexFeedResponse,
  MangaDexSearchResponse,
  MangaDexMangaItem
} from "./mangadex.client.js";
import { normalizeSlug } from "../../ingestion.normalizer.js";

/**
 * Transforms MangaDex API responses into normalized SourceMangaPayload,
 * SourceChapterPayload, and SourceSearchResult objects.
 */
export class MangaDexMapper {
  /**
   * Maps a single MangaDex manga item to normalized SourceMangaPayload.
   */
  public static mapMangaItem(item: MangaDexMangaItem): SourceMangaPayload | null {
    if (!item || !item.attributes) {
      return null;
    }

    const { id, attributes, relationships } = item;

    // 1. Extract primary title (prioritize English, then romanized Japanese, then first available)
    const title =
      attributes.title?.en ||
      attributes.title?.["ja-ro"] ||
      attributes.title?.ja ||
      Object.values(attributes.title || {})[0] ||
      "";

    if (!title) {
      return null;
    }

    // 2. Extract alternative titles
    const alternativeTitles: string[] = [];
    if (Array.isArray(attributes.altTitles)) {
      for (const altObj of attributes.altTitles) {
        for (const val of Object.values(altObj)) {
          if (val && typeof val === "string" && val.trim() && val !== title) {
            alternativeTitles.push(val.trim());
          }
        }
      }
    }

    // 3. Extract description
    const description =
      attributes.description?.en ||
      Object.values(attributes.description || {})[0] ||
      "";

    // 4. Extract author and artist from relationships
    const authors: string[] = [];
    const artists: string[] = [];
    let coverFileName: string | undefined;

    if (Array.isArray(relationships)) {
      for (const rel of relationships) {
        if (rel.type === "author" && rel.attributes?.name) {
          authors.push(rel.attributes.name.trim());
        } else if (rel.type === "artist" && rel.attributes?.name) {
          artists.push(rel.attributes.name.trim());
        } else if (rel.type === "cover_art" && rel.attributes?.fileName) {
          coverFileName = rel.attributes.fileName.trim();
        }
      }
    }

    const author = authors.join(", ") || "Unknown";
    const artist = artists.join(", ") || author;

    // 5. Construct cover image URL
    const coverImage = coverFileName
      ? `https://uploads.mangadex.org/covers/${id}/${coverFileName}`
      : "";

    // 6. Extract genres/tags
    const genres: string[] = [];
    if (Array.isArray(attributes.tags)) {
      for (const tag of attributes.tags) {
        const tagName = tag.attributes?.name?.en;
        if (tagName && typeof tagName === "string" && tagName.trim()) {
          genres.push(tagName.trim());
        }
      }
    }

    // 7. Map status
    let status: MangaStatus = "ongoing";
    if (attributes.status === "completed") {
      status = "completed";
    } else if (attributes.status === "hiatus" || attributes.status === "cancelled") {
      status = "hiatus";
    }

    return {
      sourceId: id,
      title,
      slug: normalizeSlug(title),
      alternativeTitles,
      author,
      artist,
      description,
      coverImage,
      genres,
      status,
      releaseYear: attributes.year
    };
  }

  /**
   * Maps single MangaDex manga response to normalized SourceMangaPayload.
   */
  public static mapManga(response: MangaDexMangaResponse): SourceMangaPayload | null {
    if (!response || response.result !== "ok" || !response.data) {
      return null;
    }
    return this.mapMangaItem(response.data);
  }

  /**
   * Maps MangaDex search response into normalized SourceSearchResult.
   */
  public static mapSearch(
    query: string,
    response: MangaDexSearchResponse,
    page = 1,
    limit = 20
  ): SourceSearchResult {
    const rawItems = response?.data || [];
    const total = typeof response?.total === "number" ? response.total : rawItems.length;

    const items: SourceMangaSearchItem[] = [];

    for (const rawItem of rawItems) {
      const mapped = this.mapMangaItem(rawItem);
      if (mapped) {
        items.push({
          source: "mangadex",
          sourceId: mapped.sourceId,
          slug: mapped.slug || normalizeSlug(mapped.title),
          title: mapped.title,
          alternativeTitles: mapped.alternativeTitles,
          author: mapped.author,
          artist: mapped.artist,
          description: mapped.description,
          coverImage: mapped.coverImage,
          genres: mapped.genres,
          status: mapped.status,
          rating: mapped.rating,
          releaseYear: mapped.releaseYear
        });
      }
    }

    const hasNextPage = (page - 1) * limit + items.length < total;

    return {
      source: "mangadex",
      query,
      items,
      pagination: {
        page,
        limit,
        total,
        hasNextPage
      }
    };
  }

  /**
   * Maps MangaDex chapter feed response to ordered, deduplicated SourceChapterPayload list.
   */
  public static mapChapters(
    mangaId: string,
    feedResponse: MangaDexFeedResponse
  ): SourceChapterPayload[] {
    if (!feedResponse || !Array.isArray(feedResponse.data)) {
      return [];
    }

    const chapterMap = new Map<number, SourceChapterPayload>();

    for (const item of feedResponse.data) {
      if (!item || !item.attributes) continue;

      const chapStr = item.attributes.chapter;
      if (!chapStr) continue;

      // Note: Skip decimal chapters (e.g. 1.5, 0.5) to adhere strictly to integer chapter domain model
      const parsedNum = Number(chapStr);
      if (!Number.isInteger(parsedNum) || parsedNum <= 0) {
        continue;
      }

      const rawPages =
        typeof item.attributes.pages === "number" ? Math.max(0, item.attributes.pages) : 0;
      const externalUrl = item.attributes.externalUrl?.trim() || null;

      let chapterType: "hosted" | "external" | "unavailable" = "hosted";
      if (rawPages > 0 && !externalUrl) {
        chapterType = "hosted";
      } else if (externalUrl) {
        chapterType = "external";
      } else {
        chapterType = "unavailable";
      }

      const pageCount = chapterType === "hosted" ? rawPages : 0;
      const title = item.attributes.title
        ? item.attributes.title.trim()
        : `Chapter ${parsedNum}`;

      // Deduplicate: If multiple groups uploaded chapter N:
      // Prefer hosted over external/unavailable; then prefer more pages
      const existing = chapterMap.get(parsedNum);
      const isBetter =
        !existing ||
        (chapterType === "hosted" && existing.chapterType !== "hosted") ||
        (chapterType === existing.chapterType && pageCount > existing.pageCount);

      if (isBetter) {
        chapterMap.set(parsedNum, {
          sourceId: item.id,
          mangaSourceId: mangaId,
          chapterNumber: parsedNum,
          title,
          pageCount,
          externalUrl,
          chapterType
        });
      }
    }

    return Array.from(chapterMap.values()).sort(
      (a, b) => a.chapterNumber - b.chapterNumber
    );
  }
}
