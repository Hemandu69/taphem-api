import type { SourceMangaPayload, SourceChapterPayload } from "../../source-adapter.types.js";
import type { MangaStatus } from "../../../manga/manga.types.js";
import type { MangaDexMangaResponse, MangaDexFeedResponse } from "./mangadex.client.js";

/**
 * Transforms MangaDex API responses into normalized SourceMangaPayload and SourceChapterPayload objects.
 */
export class MangaDexMapper {
  /**
   * Maps MangaDex manga response to normalized SourceMangaPayload.
   */
  public static mapManga(response: MangaDexMangaResponse): SourceMangaPayload | null {
    if (!response || response.result !== "ok" || !response.data) {
      return null;
    }

    const { id, attributes, relationships } = response.data;

    // 1. Extract primary title (prioritize English, then any available)
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

      const pageCount = item.attributes.pages > 0 ? item.attributes.pages : 1;
      const title = item.attributes.title
        ? item.attributes.title.trim()
        : `Chapter ${parsedNum}`;

      // Deduplicate: If multiple groups uploaded chapter N, keep the one with more pages or first seen
      const existing = chapterMap.get(parsedNum);
      if (!existing || pageCount > existing.pageCount) {
        chapterMap.set(parsedNum, {
          sourceId: item.id,
          mangaSourceId: mangaId,
          chapterNumber: parsedNum,
          title,
          pageCount
        });
      }
    }

    return Array.from(chapterMap.values()).sort(
      (a, b) => a.chapterNumber - b.chapterNumber
    );
  }
}
