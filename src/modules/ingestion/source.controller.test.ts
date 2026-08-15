import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Request, Response, NextFunction } from "express";
import { searchSourceManga } from "./source.controller.js";
import { sourceRegistry } from "./source.registry.js";
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
});
