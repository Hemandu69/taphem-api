import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Request, Response, NextFunction } from "express";
import {
  searchSourceManga,
  getSourceMangaDetails,
  ingestSourceManga
} from "./source.controller.js";
import { sourceRegistry } from "./source.registry.js";
import { MockMangaSourceAdapter } from "./adapters/mock.adapter.js";
import { AppError } from "../../utils/errors.js";

function createMockExpressContext(
  params: Record<string, string>,
  query: Record<string, unknown>
) {
  const req = {
    params,
    query
  } as unknown as Request;

  let statusCode = 200;
  let responseData: unknown = null;

  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(data: unknown) {
      responseData = data;
      return this;
    }
  } as unknown as Response;

  let capturedError: unknown = null;
  const next: NextFunction = (err?: unknown) => {
    capturedError = err;
  };

  return {
    req,
    res,
    next,
    getStatusCode: () => statusCode,
    getResponseData: () => responseData,
    getCapturedError: () => capturedError
  };
}

describe("Source Discovery & Search Controller", () => {
  it("should reject search request when source is unsupported (404)", async () => {
    const ctx = createMockExpressContext({ sourceId: "non_existent_source" }, { q: "test" });
    await searchSourceManga(ctx.req, ctx.res, ctx.next);

    const err = ctx.getCapturedError();
    assert.ok(err instanceof AppError);
    assert.equal((err as AppError).statusCode, 404);
    assert.equal((err as AppError).code, "UNSUPPORTED_SOURCE");
  });

  it("should reject search request when 'q' query parameter is missing or empty (400)", async () => {
    const ctx1 = createMockExpressContext({ sourceId: "mangadex" }, {});
    await searchSourceManga(ctx1.req, ctx1.res, ctx1.next);
    const err1 = ctx1.getCapturedError();
    assert.ok(err1 instanceof AppError);
    assert.equal((err1 as AppError).statusCode, 400);
    assert.equal((err1 as AppError).code, "INVALID_QUERY_PARAMS");

    const ctx2 = createMockExpressContext({ sourceId: "mangadex" }, { q: "   " });
    await searchSourceManga(ctx2.req, ctx2.res, ctx2.next);
    const err2 = ctx2.getCapturedError();
    assert.ok(err2 instanceof AppError);
    assert.equal((err2 as AppError).statusCode, 400);
    assert.equal((err2 as AppError).code, "INVALID_QUERY_PARAMS");
  });

  it("should reject invalid page parameter (400)", async () => {
    const ctx = createMockExpressContext({ sourceId: "mangadex" }, { q: "test", page: "0" });
    await searchSourceManga(ctx.req, ctx.res, ctx.next);

    const err = ctx.getCapturedError();
    assert.ok(err instanceof AppError);
    assert.equal((err as AppError).statusCode, 400);
    assert.equal((err as AppError).code, "INVALID_QUERY_PARAMS");
  });

  it("should reject invalid limit parameter outside [1, 100] (400)", async () => {
    const ctx1 = createMockExpressContext({ sourceId: "mangadex" }, { q: "test", limit: "0" });
    await searchSourceManga(ctx1.req, ctx1.res, ctx1.next);
    const err1 = ctx1.getCapturedError();
    assert.ok(err1 instanceof AppError);
    assert.equal((err1 as AppError).statusCode, 400);

    const ctx2 = createMockExpressContext({ sourceId: "mangadex" }, { q: "test", limit: "101" });
    await searchSourceManga(ctx2.req, ctx2.res, ctx2.next);
    const err2 = ctx2.getCapturedError();
    assert.ok(err2 instanceof AppError);
    assert.equal((err2 as AppError).statusCode, 400);
  });

  it("should reject source that does not implement searchManga (400)", async () => {
    sourceRegistry.register({
      sourceId: "no_search_src",
      sourceName: "No Search Source",
      fetchManga: async () => null,
      fetchChapters: async () => []
    });

    const ctx = createMockExpressContext({ sourceId: "no_search_src" }, { q: "test" });
    await searchSourceManga(ctx.req, ctx.res, ctx.next);

    const err = ctx.getCapturedError();
    assert.ok(err instanceof AppError);
    assert.equal((err as AppError).statusCode, 400);
    assert.equal((err as AppError).code, "UNSUPPORTED_SEARCH");
  });

  it("should return successful search results envelope for registered mock adapter", async () => {
    sourceRegistry.register({
      sourceId: "mock_test_adapter",
      sourceName: "Mock Test Adapter",
      fetchManga: async () => null,
      fetchChapters: async () => [],
      searchManga: async (query, options) => ({
        source: "mock_test_adapter",
        query,
        items: [
          {
            source: "mock_test_adapter",
            sourceId: "item_01",
            slug: "item-01",
            title: "Item 01",
            genres: ["Action"]
          }
        ],
        pagination: {
          page: options?.page || 1,
          limit: options?.limit || 20,
          total: 1,
          hasNextPage: false
        }
      })
    });

    const ctx = createMockExpressContext(
      { sourceId: "mock_test_adapter" },
      { q: "item", page: "1", limit: "10" }
    );
    await searchSourceManga(ctx.req, ctx.res, ctx.next);

    assert.equal(ctx.getCapturedError(), null);
    assert.equal(ctx.getStatusCode(), 200);

    const body = ctx.getResponseData() as { success: boolean; data: { source: string; query: string; items: unknown[]; pagination: unknown } };
    assert.equal(body.success, true);
    assert.equal(body.data.source, "mock_test_adapter");
    assert.equal(body.data.query, "item");
    assert.equal(body.data.items.length, 1);
  });

  describe("GET /api/v1/sources/:sourceId/manga/:externalId (Details)", () => {
    it("should reject details request when source is unsupported (404)", async () => {
      const ctx = createMockExpressContext(
        { sourceId: "non_existent_source", externalId: "some_id" },
        {}
      );
      await getSourceMangaDetails(ctx.req, ctx.res, ctx.next);

      const err = ctx.getCapturedError();
      assert.ok(err instanceof AppError);
      assert.equal((err as AppError).statusCode, 404);
      assert.equal((err as AppError).code, "UNSUPPORTED_SOURCE");
    });

    it("should reject details request when externalId is missing or empty (400)", async () => {
      const ctx = createMockExpressContext(
        { sourceId: "mangadex", externalId: "   " },
        {}
      );
      await getSourceMangaDetails(ctx.req, ctx.res, ctx.next);

      const err = ctx.getCapturedError();
      assert.ok(err instanceof AppError);
      assert.equal((err as AppError).statusCode, 400);
      assert.equal((err as AppError).code, "SOURCE_ID_REQUIRED");
    });

    it("should return normalized details with chapters and ingested=false for un-ingested manga", async () => {
      const mockAdapter = new MockMangaSourceAdapter("mock_details_source", "Mock Details Source");
      sourceRegistry.register(mockAdapter);

      const ctx = createMockExpressContext(
        { sourceId: "mock_details_source", externalId: "mock_manga_01" },
        {}
      );
      await getSourceMangaDetails(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.getCapturedError(), null);
      assert.equal(ctx.getStatusCode(), 200);

      const body = ctx.getResponseData() as {
        success: boolean;
        data: {
          source: string;
          sourceId: string;
          title: string;
          chapters: unknown[];
          ingested: boolean;
          mangaId: string | null;
          mangaSlug: string | null;
        };
      };
      assert.equal(body.success, true);
      assert.equal(body.data.source, "mock_details_source");
      assert.equal(body.data.sourceId, "mock_manga_01");
      assert.equal(body.data.title, "Neon Valkyrie");
      assert.equal(body.data.chapters.length, 3);
      assert.equal(body.data.ingested, false);
      assert.equal(body.data.mangaId, null);
      assert.equal(body.data.mangaSlug, null);
    });

    it("should return 404 MANGA_SOURCE_NOT_FOUND when external manga does not exist on source", async () => {
      const mockAdapter = new MockMangaSourceAdapter("mock_details_src_2", "Mock Details 2");
      sourceRegistry.register(mockAdapter);

      const ctx = createMockExpressContext(
        { sourceId: "mock_details_src_2", externalId: "unknown_external_id" },
        {}
      );
      await getSourceMangaDetails(ctx.req, ctx.res, ctx.next);

      const err = ctx.getCapturedError();
      assert.ok(err instanceof AppError);
      assert.equal((err as AppError).statusCode, 404);
      assert.equal((err as AppError).code, "MANGA_SOURCE_NOT_FOUND");
    });
  });

  describe("POST /api/v1/sources/:sourceId/manga/:externalId/ingest (Ingestion)", () => {
    it("should reject ingest request when source is unsupported (404)", async () => {
      const ctx = createMockExpressContext(
        { sourceId: "non_existent_source", externalId: "some_id" },
        {}
      );
      await ingestSourceManga(ctx.req, ctx.res, ctx.next);

      const err = ctx.getCapturedError();
      assert.ok(err instanceof AppError);
      assert.equal((err as AppError).statusCode, 404);
      assert.equal((err as AppError).code, "UNSUPPORTED_SOURCE");
    });

    it("should reject ingest request when externalId is missing or empty (400)", async () => {
      const ctx = createMockExpressContext(
        { sourceId: "mangadex", externalId: "" },
        {}
      );
      await ingestSourceManga(ctx.req, ctx.res, ctx.next);

      const err = ctx.getCapturedError();
      assert.ok(err instanceof AppError);
      assert.equal((err as AppError).statusCode, 400);
      assert.equal((err as AppError).code, "SOURCE_ID_REQUIRED");
    });

    it("should ingest manga from source and return CREATED on first call, UNCHANGED on second", async () => {
      const mockAdapter = new MockMangaSourceAdapter("mock_ingest_source", "Mock Ingest Source");
      const uniqueSuffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      const uniqueId = `mock-manga-${uniqueSuffix}`;
      const uniqueSlug = `unique-ingest-${uniqueSuffix}`;
      const uniqueTitle = `Unique Story ${uniqueSuffix}`;

      mockAdapter.setMockManga({
        sourceId: uniqueId,
        title: uniqueTitle,
        slug: uniqueSlug,
        author: "Test Author",
        artist: "Test Artist",
        description: "A completely unique test story.",
        genres: ["Adventure", "Fantasy"],
        status: "ongoing",
        releaseYear: 2025
      });
      mockAdapter.setMockChapters(uniqueId, [
        {
          sourceId: `u_chap_01_${uniqueSuffix}`,
          mangaSourceId: uniqueId,
          chapterNumber: 1,
          title: "Chapter 1",
          pageCount: 15
        },
        {
          sourceId: `u_chap_02_${uniqueSuffix}`,
          mangaSourceId: uniqueId,
          chapterNumber: 2,
          title: "Chapter 2",
          pageCount: 18
        }
      ]);
      sourceRegistry.register(mockAdapter);

      // First call -> CREATED
      const ctx1 = createMockExpressContext(
        { sourceId: "mock_ingest_source", externalId: uniqueId },
        {}
      );
      await ingestSourceManga(ctx1.req, ctx1.res, ctx1.next);

      assert.equal(ctx1.getCapturedError(), null);
      const body1 = ctx1.getResponseData() as {
        success: boolean;
        data: { action: string; source: string; mangaId: string; slug: string; chaptersCount: number };
      };
      assert.equal(body1.success, true);
      assert.equal(body1.data.action, "CREATED");
      assert.equal(body1.data.source, "mock_ingest_source");
      assert.equal(body1.data.slug, uniqueSlug);
      assert.equal(body1.data.chaptersCount, 2);

      // Second call -> UNCHANGED
      const ctx2 = createMockExpressContext(
        { sourceId: "mock_ingest_source", externalId: uniqueId },
        {}
      );
      await ingestSourceManga(ctx2.req, ctx2.res, ctx2.next);

      assert.equal(ctx2.getCapturedError(), null);
      const body2 = ctx2.getResponseData() as {
        success: boolean;
        data: { action: string; mangaId: string };
      };
      assert.equal(body2.success, true);
      assert.equal(body2.data.action, "UNCHANGED");
      assert.equal(body2.data.mangaId, body1.data.mangaId);

      // Verify that getSourceMangaDetails now returns ingested=true
      const ctxDetails = createMockExpressContext(
        { sourceId: "mock_ingest_source", externalId: uniqueId },
        {}
      );
      await getSourceMangaDetails(ctxDetails.req, ctxDetails.res, ctxDetails.next);
      const detailsBody = ctxDetails.getResponseData() as {
        success: boolean;
        data: { ingested: boolean; mangaId: string; mangaSlug: string };
      };
      assert.equal(detailsBody.data.ingested, true);
      assert.equal(detailsBody.data.mangaId, body1.data.mangaId);
      assert.equal(detailsBody.data.mangaSlug, uniqueSlug);
    });
  });
});

