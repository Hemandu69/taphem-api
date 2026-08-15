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
            pageCount: 0
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
});
