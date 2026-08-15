import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { MockMangaSourceAdapter } from "./adapters/mock.adapter.js";
import { IngestionService } from "./ingestion.service.js";
import { StaticIngestionRepository } from "./ingestion.repository.js";
import {
  normalizeSlug,
  normalizeGenre,
  validateAndNormalizeManga,
  validateAndNormalizeChapter
} from "./ingestion.normalizer.js";
import { AppError } from "../../utils/errors.js";

describe("Catalog Ingestion Foundation", () => {
  let staticRepo: StaticIngestionRepository;
  let service: IngestionService;
  let mockAdapter: MockMangaSourceAdapter;

  beforeEach(() => {
    staticRepo = new StaticIngestionRepository();
    service = new IngestionService(staticRepo);
    mockAdapter = new MockMangaSourceAdapter();
  });

  describe("1. Source Adapter Contract", () => {
    it("should fetch normalized manga and chapters from MockMangaSourceAdapter", async () => {
      const manga = await mockAdapter.fetchManga("mock_manga_01");
      assert.ok(manga);
      assert.equal(manga?.title, "Neon Valkyrie");
      assert.equal(manga?.genres?.length, 4);

      const chapters = await mockAdapter.fetchChapters("mock_manga_01");
      assert.equal(chapters.length, 3);
      assert.equal(chapters[0]?.chapterNumber, 1);
      assert.equal(chapters[0]?.pageCount, 8);
    });

    it("should return null for non-existent source manga ID", async () => {
      const manga = await mockAdapter.fetchManga("non_existent_id");
      assert.equal(manga, null);
    });
  });

  describe("2. Normalization & Validation", () => {
    it("should normalize slugs consistently across various input formats", () => {
      assert.equal(normalizeSlug("Neon Valkyrie: 2088!"), "neon-valkyrie-2088");
      assert.equal(normalizeSlug("Solo Leveling (Season 2)"), "solo-leveling-season-2");
      assert.equal(normalizeSlug("  Demon's   Blade  "), "demons-blade");
      assert.equal(normalizeSlug("---cyber-punk---"), "cyber-punk");
    });

    it("should normalize genres and deduplicate casing variations", () => {
      const g1 = normalizeGenre("sci-fi");
      const g2 = normalizeGenre("SCI-FI");
      const g3 = normalizeGenre("Sci Fi");

      assert.equal(g1.slug, "sci-fi");
      assert.equal(g2.slug, "sci-fi");
      assert.equal(g3.slug, "sci-fi");
      assert.equal(g1.name, "Sci-Fi");

      const g4 = normalizeGenre("martial arts");
      assert.equal(g4.name, "Martial Arts");
      assert.equal(g4.slug, "martial-arts");
    });

    it("should reject manga with missing source or title", () => {
      assert.throws(
        () => validateAndNormalizeManga({ source: "", sourceId: "1", title: "Test" }),
        (err: unknown) => err instanceof AppError && err.code === "SOURCE_ID_REQUIRED"
      );

      assert.throws(
        () => validateAndNormalizeManga({ source: "srcA", sourceId: "", title: "Test" }),
        (err: unknown) => err instanceof AppError && err.code === "SOURCE_ID_REQUIRED"
      );

      assert.throws(
        () => validateAndNormalizeManga({ source: "srcA", sourceId: "1", title: "" }),
        (err: unknown) => err instanceof AppError && err.code === "INVALID_INGESTION_INPUT"
      );
    });

    it("should reject invalid chapter numbers and page counts", () => {
      assert.throws(
        () =>
          validateAndNormalizeChapter({
            source: "srcA",
            sourceId: "c1",
            mangaSourceId: "m1",
            chapterNumber: 0,
            pageCount: 10
          }),
        (err: unknown) => err instanceof AppError && err.code === "INVALID_CHAPTER_NUMBER"
      );

      assert.throws(
        () =>
          validateAndNormalizeChapter({
            source: "srcA",
            sourceId: "c1",
            mangaSourceId: "m1",
            chapterNumber: 1,
            pageCount: -1
          }),
        (err: unknown) => err instanceof AppError && err.code === "INVALID_PAGE_COUNT"
      );
    });
  });

  describe("3. Ingestion & Idempotency", () => {
    it("should ingest a manga with chapters and return CREATED on first run", async () => {
      const result = await service.ingestFromAdapter(mockAdapter, "mock_manga_01");

      assert.equal(result.action, "CREATED");
      assert.equal(result.slug, "neon-valkyrie");
      assert.equal(result.title, "Neon Valkyrie");
      assert.equal(result.chaptersCount, 3);
      assert.equal(result.genresCount, 4);
    });

    it("should return UNCHANGED when ingesting identical data a second time", async () => {
      const first = await service.ingestFromAdapter(mockAdapter, "mock_manga_01");
      assert.equal(first.action, "CREATED");

      const second = await service.ingestFromAdapter(mockAdapter, "mock_manga_01");
      assert.equal(second.action, "UNCHANGED");
      assert.equal(second.mangaId, first.mangaId);
      assert.equal(second.chaptersCount, 3);
    });

    it("should return UPDATED when manga description or rating changes", async () => {
      await service.ingestFromAdapter(mockAdapter, "mock_manga_01");

      mockAdapter.setMockManga({
        sourceId: "mock_manga_01",
        title: "Neon Valkyrie",
        slug: "neon-valkyrie",
        description: "Updated description for season 2.",
        rating: 9.8
      });

      const updated = await service.ingestFromAdapter(mockAdapter, "mock_manga_01");
      assert.equal(updated.action, "UPDATED");
      assert.equal(updated.title, "Neon Valkyrie");
    });

    it("should update chapter from hosted (pageCount=1) to external (pageCount=0, externalUrl) on re-sync", async () => {
      // 1. Initial ingestion with old-style pageCount=1, no externalUrl
      await service.ingestManga(
        { source: "mangadex", sourceId: "32d76d19", slug: "na-honjaman-level-up", title: "Na Honjaman Level-Up" },
        [
          {
            source: "mangadex",
            sourceId: "de1757bd",
            mangaSourceId: "32d76d19",
            chapterNumber: 1,
            title: "The Weakest Hunter",
            pageCount: 1,
            chapterType: "hosted"
          }
        ]
      );

      // Verify stored state before re-sync
      const beforeChapters = staticRepo.getChapters("na-honjaman-level-up");
      assert.equal(beforeChapters.length, 1);
      assert.equal(beforeChapters[0]?.pageCount, 1);
      assert.equal(beforeChapters[0]?.chapterType, "hosted");
      assert.equal(beforeChapters[0]?.externalUrl, null);

      // 2. Re-sync with new externalUrl and pageCount=0
      await service.ingestManga(
        { source: "mangadex", sourceId: "32d76d19", slug: "na-honjaman-level-up", title: "Na Honjaman Level-Up" },
        [
          {
            source: "mangadex",
            sourceId: "de1757bd",
            mangaSourceId: "32d76d19",
            chapterNumber: 1,
            title: "The Weakest Hunter",
            pageCount: 0,
            externalUrl: "https://www.webnovel.com/comic/15227640605485101/45196190333068497",
            chapterType: "external"
          }
        ]
      );

      // Verify stored state after re-sync
      const afterChapters = staticRepo.getChapters("na-honjaman-level-up");
      assert.equal(afterChapters.length, 1);
      assert.equal(afterChapters[0]?.pageCount, 0);
      assert.equal(afterChapters[0]?.chapterType, "external");
      assert.equal(
        afterChapters[0]?.externalUrl,
        "https://www.webnovel.com/comic/15227640605485101/45196190333068497"
      );
    });

    it("should reject payloads with duplicate chapter numbers", async () => {
      await assert.rejects(
        () =>
          service.ingestManga(
            { source: "srcA", sourceId: "m1", title: "Test Manga" },
            [
              { source: "srcA", sourceId: "c1", mangaSourceId: "m1", chapterNumber: 1, pageCount: 10 },
              { source: "srcA", sourceId: "c2", mangaSourceId: "m1", chapterNumber: 1, pageCount: 12 }
            ]
          ),
        (err: unknown) => err instanceof AppError && err.code === "DUPLICATE_SOURCE_RECORD"
      );
    });
  });

  describe("4. Source Identity Isolation", () => {
    it("should not collide when two different sources provide the same sourceId", async () => {
      const adapterA = new MockMangaSourceAdapter("source_alpha", "Alpha Source");
      const adapterB = new MockMangaSourceAdapter("source_beta", "Beta Source");

      adapterA.setMockManga({
        sourceId: "shared_id_999",
        title: "Alpha Chronicle",
        slug: "alpha-chronicle"
      });

      adapterB.setMockManga({
        sourceId: "shared_id_999",
        title: "Beta Odyssey",
        slug: "beta-odyssey"
      });

      const resultA = await service.ingestFromAdapter(adapterA, "shared_id_999");
      const resultB = await service.ingestFromAdapter(adapterB, "shared_id_999");

      assert.notEqual(resultA.mangaId, resultB.mangaId);
      assert.equal(resultA.slug, "alpha-chronicle");
      assert.equal(resultB.slug, "beta-odyssey");
    });
  });

  describe("5. Source Manga Details & Ingestion Status", () => {
    it("should retrieve full source manga details without ingesting (read-only, ingested=false)", async () => {
      const details = await service.getSourceMangaDetails(mockAdapter, "mock_manga_01");

      assert.equal(details.source, "mock_source");
      assert.equal(details.sourceId, "mock_manga_01");
      assert.equal(details.title, "Neon Valkyrie");
      assert.equal(details.author, "Shinjiro Takahashi");
      assert.equal(details.chapters.length, 3);
      assert.equal(details.chapters[0]?.chapterNumber, 1);
      assert.equal(details.ingested, false);
      assert.equal(details.mangaId, null);
      assert.equal(details.mangaSlug, null);

      // Verify no record exists in repository
      const inRepo = await staticRepo.findMangaBySource("mock_source", "mock_manga_01");
      assert.equal(inRepo, null);
    });

    it("should accurately report ingested=true and mangaId after ingestion", async () => {
      // Ingest first
      const ingested = await service.ingestFromAdapter(mockAdapter, "mock_manga_01");
      assert.equal(ingested.action, "CREATED");

      // Query details
      const details = await service.getSourceMangaDetails(mockAdapter, "mock_manga_01");
      assert.equal(details.ingested, true);
      assert.equal(details.mangaId, ingested.mangaId);
      assert.equal(details.mangaSlug, "neon-valkyrie");
    });

    it("should throw MANGA_SOURCE_NOT_FOUND when external manga is not found", async () => {
      await assert.rejects(
        () => service.getSourceMangaDetails(mockAdapter, "unknown_external_id"),
        (err: unknown) => err instanceof AppError && err.code === "MANGA_SOURCE_NOT_FOUND"
      );
    });

    it("should throw SOURCE_ID_REQUIRED when external ID is empty", async () => {
      await assert.rejects(
        () => service.getSourceMangaDetails(mockAdapter, "   "),
        (err: unknown) => err instanceof AppError && err.code === "SOURCE_ID_REQUIRED"
      );
    });
  });
});

