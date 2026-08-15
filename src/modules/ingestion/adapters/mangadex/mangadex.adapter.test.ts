import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MangaDexAdapter } from "./mangadex.adapter.js";
import { MangaDexMapper } from "./mangadex.mapper.js";
import type {
  MangaDexHttpClient,
  MangaDexMangaResponse,
  MangaDexFeedResponse
} from "./mangadex.client.js";
import { SourceRegistry } from "../../source.registry.js";
import { IngestionService } from "../../ingestion.service.js";
import { StaticIngestionRepository } from "../../ingestion.repository.js";

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

  public async getManga(_mangaId: string): Promise<MangaDexMangaResponse | null> {
    return this.mangaToReturn;
  }

  public async getChapterFeed(_mangaId: string): Promise<MangaDexFeedResponse> {
    return this.feedToReturn;
  }
}

describe("MangaDex Real Source Adapter", () => {
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
  });

  describe("3. MangaDexAdapter Contract & Adapter Methods", () => {
    it("should satisfy MangaSourceAdapter contract", async () => {
      const mockClient = new MockMangaDexHttpClient();
      const adapter = new MangaDexAdapter(mockClient);

      assert.equal(adapter.sourceId, "mangadex");
      assert.equal(adapter.sourceName, "MangaDex");

      const manga = await adapter.fetchManga("32d76d19-8a05-4db0-9fc2-e0b0648fe9d0");
      assert.ok(manga);
      assert.equal(manga?.title, "Solo Leveling");

      const chapters = await adapter.fetchChapters("32d76d19-8a05-4db0-9fc2-e0b0648fe9d0");
      assert.equal(chapters.length, 2);
    });

    it("should return null if manga is not found on client", async () => {
      const mockClient = new MockMangaDexHttpClient();
      mockClient.mangaToReturn = null;
      const adapter = new MangaDexAdapter(mockClient);

      const manga = await adapter.fetchManga("unknown-id");
      assert.equal(manga, null);
    });
  });

  describe("4. SourceRegistry", () => {
    it("should have MangaDex registered by default", () => {
      const registry = new SourceRegistry();
      assert.ok(registry.has("mangadex"));
      assert.ok(registry.has("MANGADEX")); // Case-insensitive lookup

      const adapter = registry.get("mangadex");
      assert.ok(adapter);
      assert.equal(adapter?.sourceId, "mangadex");
    });

    it("should return undefined for unregistered sources", () => {
      const registry = new SourceRegistry();
      assert.equal(registry.get("unknown_source"), undefined);
      assert.equal(registry.has("unknown_source"), false);
    });

    it("should allow registering custom adapters", () => {
      const registry = new SourceRegistry();
      registry.register({
        sourceId: "custom_v2",
        sourceName: "Custom V2",
        fetchManga: async () => null,
        fetchChapters: async () => []
      });

      assert.ok(registry.has("custom_v2"));
      assert.equal(registry.get("custom_v2")?.sourceName, "Custom V2");
    });
  });

  describe("5. End-to-End Ingestion Flow with MangaDex Adapter", () => {
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
  });
});
