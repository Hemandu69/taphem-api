import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MangaDexAdapter } from "./mangadex.adapter.js";
import { MangaDexMapper } from "./mangadex.mapper.js";
import type {
  MangaDexHttpClient,
  MangaDexMangaResponse,
  MangaDexFeedResponse,
  MangaDexSearchResponse
} from "./mangadex.client.js";
import { SourceRegistry } from "../../source.registry.js";
import { IngestionService } from "../../ingestion.service.js";
import { StaticIngestionRepository } from "../../ingestion.repository.js";
import { MockMangaSourceAdapter } from "../mock.adapter.js";
import { AppError } from "../../../../utils/errors.js";

// Mock MangaDex responses for deterministic offline testing
const sampleMangaDexMangaResponse: MangaDexMangaResponse = {
  result: "ok",
  data: {
    id: "32d76d19-8a05-4db0-9fc2-e0b0648fe9d0",
    type: "manga",
    attributes: {
      title: {
        en: "Solo Leveling"
      },
      altTitles: [
        { ko: "나 혼자만 레벨업" },
        { "ja-ro": "Na Honjaman Level Up" }
      ],
      description: {
        en: "10 years ago, after the Gate that connected the real world with the monster world opened..."
      },
      status: "completed",
      year: 2018,
      tags: [
        {
          id: "tag_action",
          attributes: {
            name: { en: "Action" },
            group: "genre"
          }
        },
        {
          id: "tag_fantasy",
          attributes: {
            name: { en: "Fantasy" },
            group: "genre"
          }
        },
        {
          id: "tag_scifi",
          attributes: {
            name: { en: "Sci-Fi" },
            group: "genre"
          }
        }
      ]
    },
    relationships: [
      {
        id: "auth_01",
        type: "author",
        attributes: { name: "Chugong" }
      },
      {
        id: "art_01",
        type: "artist",
        attributes: { name: "DUBU (REDICE STUDIO)" }
      },
      {
        id: "cov_01",
        type: "cover_art",
        attributes: { fileName: "solo-cover.jpg" }
      }
    ]
  }
};

const sampleMangaDexSearchResponse: MangaDexSearchResponse = {
  result: "ok",
  limit: 20,
  offset: 0,
  total: 45,
  data: [
    sampleMangaDexMangaResponse.data!,
    {
      id: "a1c7c817-4e59-42b5-bd33-02041e32329a",
      type: "manga",
      attributes: {
        title: { en: "Solo Bug Player" },
        altTitles: [{ ko: "나 혼자 버그로 꿀빠는 플레이어" }],
        description: { en: "He knows every bug in the game..." },
        status: "ongoing",
        year: 2020,
        tags: [
          {
            id: "tag_action",
            attributes: { name: { en: "Action" }, group: "genre" }
          }
        ]
      },
      relationships: [
        {
          id: "cov_02",
          type: "cover_art",
          attributes: { fileName: "bug-player.jpg" }
        }
      ]
    }
  ]
};

const sampleMangaDexFeedResponse: MangaDexFeedResponse = {
  result: "ok",
  total: 4,
  data: [
    {
      id: "md_chap_02",
      type: "chapter",
      attributes: {
        chapter: "2",
        title: "D-Rank Dungeon",
        pages: 18
      }
    },
    {
      id: "md_chap_01",
      type: "chapter",
      attributes: {
        chapter: "1",
        title: "The Weakest Hunter",
        pages: 20
      }
    },
    {
      id: "md_chap_01_dup",
      type: "chapter",
      attributes: {
        chapter: "1",
        title: "The Weakest Hunter (Alt Group)",
        pages: 22
      }
    },
    {
      id: "md_chap_1_5",
      type: "chapter",
      attributes: {
        chapter: "1.5",
        title: "Side Story",
        pages: 5
      }
    },
    {
      id: "md_chap_invalid",
      type: "chapter",
      attributes: {
        chapter: "none",
        title: "Special Promo",
        pages: 2
      }
    }
  ]
};

class MockMangaDexHttpClient implements MangaDexHttpClient {
  public mangaToReturn: MangaDexMangaResponse | null = sampleMangaDexMangaResponse;
  public feedToReturn: MangaDexFeedResponse = sampleMangaDexFeedResponse;
  public searchToReturn: MangaDexSearchResponse = sampleMangaDexSearchResponse;
  public lastSearchParams: { title?: string; limit?: number; offset?: number } | null = null;

  public async getManga(_mangaId: string): Promise<MangaDexMangaResponse | null> {
    return this.mangaToReturn;
  }

  public async getChapterFeed(_mangaId: string): Promise<MangaDexFeedResponse> {
    return this.feedToReturn;
  }

  public async searchManga(params: {
    title?: string;
    limit?: number;
    offset?: number;
  }): Promise<MangaDexSearchResponse> {
    this.lastSearchParams = params;
    return this.searchToReturn;
  }

  public async getAtHomeServer(_chapterId: string) {
    return null;
  }

  public async downloadChapterPage(_pageUrl: string) {
    return null;
  }
}

describe("MangaDex Real Source Adapter & Discovery", () => {
  describe("1. Manga Mapping", () => {
    it("should transform MangaDex manga response into normalized SourceMangaPayload", () => {
      const payload = MangaDexMapper.mapManga(sampleMangaDexMangaResponse);
      assert.ok(payload);
      assert.equal(payload?.sourceId, "32d76d19-8a05-4db0-9fc2-e0b0648fe9d0");
      assert.equal(payload?.title, "Solo Leveling");
      assert.equal(payload?.author, "Chugong");
      assert.equal(payload?.artist, "DUBU (REDICE STUDIO)");
      assert.equal(payload?.status, "completed");
      assert.equal(payload?.releaseYear, 2018);
      assert.equal(
        payload?.coverImage,
        "https://uploads.mangadex.org/covers/32d76d19-8a05-4db0-9fc2-e0b0648fe9d0/solo-cover.jpg"
      );
      assert.deepEqual(payload?.genres, ["Action", "Fantasy", "Sci-Fi"]);
      assert.ok((payload?.alternativeTitles || []).includes("나 혼자만 레벨업"));
    });

    it("should return null for empty or error manga response", () => {
      assert.equal(MangaDexMapper.mapManga(null as unknown as MangaDexMangaResponse), null);
      assert.equal(
        MangaDexMapper.mapManga({ result: "error" } as MangaDexMangaResponse),
        null
      );
    });
  });

  describe("2. Chapter Mapping & Filtering", () => {
    it("should map, deduplicate, and order chapters ascending", () => {
      const chapters = MangaDexMapper.mapChapters(
        "32d76d19-8a05-4db0-9fc2-e0b0648fe9d0",
        sampleMangaDexFeedResponse
      );

      assert.equal(chapters.length, 2);
      assert.equal(chapters[0]?.chapterNumber, 1);
      assert.equal(chapters[0]?.pageCount, 22); // Picked higher page count from duplicate uploads
      assert.equal(chapters[1]?.chapterNumber, 2);
      assert.equal(chapters[1]?.pageCount, 18);
    });

    it("should filter out non-integer/decimal chapters (e.g. 1.5, 'none')", () => {
      const chapters = MangaDexMapper.mapChapters("test_id", sampleMangaDexFeedResponse);
      const chapterNumbers = chapters.map((c) => c.chapterNumber);
      assert.deepEqual(chapterNumbers, [1, 2]);
    });

    it("should map external chapters with pages=0 and externalUrl to chapterType='external'", () => {
      const externalFeed: MangaDexFeedResponse = {
        result: "ok",
        data: [
          {
            id: "md_ext_01",
            type: "chapter",
            attributes: {
              chapter: "1",
              title: "External Title",
              pages: 0,
              externalUrl: "https://www.webnovel.com/comic/123"
            }
          },
          {
            id: "md_unavail_02",
            type: "chapter",
            attributes: {
              chapter: "2",
              title: "Unavailable Title",
              pages: 0,
              externalUrl: null
            }
          },
          {
            id: "md_hosted_03",
            type: "chapter",
            attributes: {
              chapter: "3",
              title: "Hosted Title",
              pages: 15,
              externalUrl: null
            }
          }
        ]
      };

      const chapters = MangaDexMapper.mapChapters("test_id", externalFeed);
      assert.equal(chapters.length, 3);

      assert.equal(chapters[0]?.chapterNumber, 1);
      assert.equal(chapters[0]?.pageCount, 0);
      assert.equal(chapters[0]?.externalUrl, "https://www.webnovel.com/comic/123");
      assert.equal(chapters[0]?.chapterType, "external");

      assert.equal(chapters[1]?.chapterNumber, 2);
      assert.equal(chapters[1]?.pageCount, 0);
      assert.equal(chapters[1]?.externalUrl, null);
      assert.equal(chapters[1]?.chapterType, "unavailable");

      assert.equal(chapters[2]?.chapterNumber, 3);
      assert.equal(chapters[2]?.pageCount, 15);
      assert.equal(chapters[2]?.externalUrl, null);
      assert.equal(chapters[2]?.chapterType, "hosted");
    });
  });

  describe("3. Search & Discovery Mapping", () => {
    it("should map search results into normalized SourceSearchResult with pagination", () => {
      const result = MangaDexMapper.mapSearch(
        "solo leveling",
        sampleMangaDexSearchResponse,
        1,
        20
      );

      assert.equal(result.source, "mangadex");
      assert.equal(result.query, "solo leveling");
      assert.equal(result.items.length, 2);
      assert.equal(result.items[0]?.title, "Solo Leveling");
      assert.equal(result.items[0]?.slug, "solo-leveling");
      assert.equal(result.items[1]?.title, "Solo Bug Player");
      assert.equal(result.items[1]?.slug, "solo-bug-player");

      assert.equal(result.pagination.page, 1);
      assert.equal(result.pagination.limit, 20);
      assert.equal(result.pagination.total, 45);
      assert.equal(result.pagination.hasNextPage, true);
    });

    it("should calculate hasNextPage correctly on the final page", () => {
      const result = MangaDexMapper.mapSearch(
        "solo leveling",
        {
          result: "ok",
          limit: 20,
          offset: 40,
          total: 42,
          data: [sampleMangaDexMangaResponse.data!, sampleMangaDexMangaResponse.data!]
        },
        3,
        20
      );

      assert.equal(result.pagination.page, 3);
      assert.equal(result.pagination.total, 42);
      assert.equal(result.pagination.hasNextPage, false);
    });
  });

  describe("4. MangaDexAdapter Contract & Search Delegation", () => {
    it("should delegate search with calculated limit and offset", async () => {
      const mockClient = new MockMangaDexHttpClient();
      const adapter = new MangaDexAdapter(mockClient);

      const results = await adapter.searchManga("solo leveling", { page: 2, limit: 15 });

      assert.ok(mockClient.lastSearchParams);
      assert.equal(mockClient.lastSearchParams?.title, "solo leveling");
      assert.equal(mockClient.lastSearchParams?.limit, 15);
      assert.equal(mockClient.lastSearchParams?.offset, 15); // (2 - 1) * 15

      assert.equal(results.source, "mangadex");
      assert.equal(results.pagination.page, 2);
      assert.equal(results.pagination.limit, 15);
    });

    it("should enforce limit bounds between 1 and 100", async () => {
      const mockClient = new MockMangaDexHttpClient();
      const adapter = new MangaDexAdapter(mockClient);

      await adapter.searchManga("test", { page: 1, limit: 500 });
      assert.equal(mockClient.lastSearchParams?.limit, 100);

      await adapter.searchManga("test", { page: 1, limit: -5 });
      assert.equal(mockClient.lastSearchParams?.limit, 1);
    });
  });

  describe("5. SourceRegistry & Mock Adapter Search", () => {
    it("should resolve search through SourceRegistry with registered adapter", async () => {
      const registry = new SourceRegistry();
      const adapter = registry.get("mangadex");
      assert.ok(adapter);
      assert.equal(typeof adapter?.searchManga, "function");
    });

    it("should perform in-memory search on MockMangaSourceAdapter", async () => {
      const mockAdapter = new MockMangaSourceAdapter();
      const result = await mockAdapter.searchManga("valkyrie", { page: 1, limit: 10 });

      assert.equal(result.source, "mock_source");
      assert.equal(result.items.length, 1);
      assert.equal(result.items[0]?.title, "Neon Valkyrie");
      assert.equal(result.pagination.total, 1);
      assert.equal(result.pagination.hasNextPage, false);
    });
  });

  describe("6. End-to-End Ingestion Flow with MangaDex Adapter", () => {
    it("should ingest Solo Leveling via MangaDexAdapter through IngestionService", async () => {
      const mockClient = new MockMangaDexHttpClient();
      const adapter = new MangaDexAdapter(mockClient);
      const staticRepo = new StaticIngestionRepository();
      const service = new IngestionService(staticRepo);

      const result = await service.ingestFromAdapter(
        adapter,
        "32d76d19-8a05-4db0-9fc2-e0b0648fe9d0"
      );

      assert.equal(result.action, "CREATED");
      assert.equal(result.slug, "solo-leveling");
      assert.equal(result.title, "Solo Leveling");
      assert.equal(result.chaptersCount, 2);
      assert.equal(result.genresCount, 3);

      // Verify second ingestion is idempotent UNCHANGED
      const secondResult = await service.ingestFromAdapter(
        adapter,
        "32d76d19-8a05-4db0-9fc2-e0b0648fe9d0"
      );
      assert.equal(secondResult.action, "UNCHANGED");
    });

    it("should fetch full details and chapters concurrently via fetchMangaDetails", async () => {
      const mockClient = new MockMangaDexHttpClient();
      const adapter = new MangaDexAdapter(mockClient);

      const details = await adapter.fetchMangaDetails("32d76d19-8a05-4db0-9fc2-e0b0648fe9d0");
      assert.ok(details);
      assert.equal(details?.manga.title, "Solo Leveling");
      assert.equal(details?.chapters.length, 2);
      assert.equal(details?.chapters[0]?.chapterNumber, 1);
    });

    it("should return null from fetchMangaDetails if manga is not found", async () => {
      const mockClient = new MockMangaDexHttpClient();
      mockClient.mangaToReturn = null;
      const adapter = new MangaDexAdapter(mockClient);

      const details = await adapter.fetchMangaDetails("non_existent");
      assert.equal(details, null);
    });
  });

  describe("7. Error Handling & Edge Cases", () => {
    it("should handle rate limit 429 AppError properly", () => {
      const err = new AppError("Rate limit", 429, "SOURCE_RATE_LIMIT");
      assert.equal(err.statusCode, 429);
      assert.equal(err.code, "SOURCE_RATE_LIMIT");
    });

    it("should handle timeout AppError properly", () => {
      const err = new AppError("Timeout", 504, "SOURCE_TIMEOUT");
      assert.equal(err.statusCode, 504);
      assert.equal(err.code, "SOURCE_TIMEOUT");
    });
  });
});

