import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import type { Request, Response } from "express";
import { ChapterService } from "./chapter.service.js";
import { ChapterController } from "./chapter.controller.js";
import { StaticChapterRepository } from "./chapter.repository.js";
import { StaticMangaRepository } from "../manga/manga.repository.js";
import { StorageService } from "../../infrastructure/storage/storage.service.js";
import type { MangaDexHttpClient, MangaDexAtHomeResponse, MangaDexMangaResponse, MangaDexFeedResponse, MangaDexSearchResponse } from "../ingestion/adapters/mangadex/mangadex.client.js";
import { AppError } from "../../utils/errors.js";

/**
 * Mock MangaDex HTTP client for testing @Home server resolution and page downloading.
 */
class MockMangaDexClient implements MangaDexHttpClient {
  public atHomeResponse: MangaDexAtHomeResponse | null = null;
  public pageDownloadResult: { buffer: Buffer; contentType: string } | null = null;
  public downloadedUrls: string[] = [];

  public async getManga(): Promise<MangaDexMangaResponse | null> {
    return null;
  }

  public async getChapterFeed(): Promise<MangaDexFeedResponse> {
    return { result: "ok", data: [] };
  }

  public async searchManga(): Promise<MangaDexSearchResponse> {
    return { result: "ok", data: [] };
  }

  public async getAtHomeServer(chapterId: string): Promise<MangaDexAtHomeResponse | null> {
    if (this.atHomeResponse) {
      return this.atHomeResponse;
    }
    if (chapterId === "valid-mangadex-hosted-chapter-id") {
      return {
        result: "ok",
        baseUrl: "https://uploads.mangadex.org",
        chapter: {
          hash: "abc123hash",
          data: ["01-page1.jpg", "02-page2.png"],
          dataSaver: ["01-page1.jpg", "02-page2.jpg"]
        }
      };
    }
    if (chapterId === "valid-mangadex-external-chapter-id") {
      return {
        result: "ok",
        baseUrl: "https://uploads.mangadex.org",
        chapter: {
          hash: "",
          data: [],
          dataSaver: []
        }
      };
    }
    return null;
  }

  public async downloadChapterPage(pageUrl: string): Promise<{ buffer: Buffer; contentType: string } | null> {
    this.downloadedUrls.push(pageUrl);
    if (this.pageDownloadResult) {
      return this.pageDownloadResult;
    }
    if (pageUrl.endsWith(".png")) {
      return { buffer: Buffer.from("fake-png-data"), contentType: "image/png" };
    }
    return { buffer: Buffer.from("fake-jpeg-data"), contentType: "image/jpeg" };
  }
}

describe("Chapter Page Delivery & MangaDex @Home Integration", () => {
  it("should validate page number < 1 and reject with 400 INVALID_PAGE_NUMBER", async () => {
    const service = new ChapterService();
    await assert.rejects(
      () => service.getPage("neon-valkyrie", 1, 0),
      (err: unknown) => err instanceof AppError && err.code === "INVALID_PAGE_NUMBER"
    );
    await assert.rejects(
      () => service.getPage("neon-valkyrie", 1, -1),
      (err: unknown) => err instanceof AppError && err.code === "INVALID_PAGE_NUMBER"
    );
  });

  it("should validate page number > page_count and reject with PAGE_OUT_OF_BOUNDS", async () => {
    const service = new ChapterService();
    await assert.rejects(
      () => service.getPage("neon-valkyrie", 1, 999),
      (err: unknown) => err instanceof AppError && err.code === "PAGE_OUT_OF_BOUNDS"
    );
  });

  it("should reject when manga does not exist with 404 MANGA_NOT_FOUND", async () => {
    const service = new ChapterService();
    await assert.rejects(
      () => service.getPage("non-existent-manga", 1, 1),
      (err: unknown) => err instanceof AppError && err.code === "MANGA_NOT_FOUND"
    );
  });

  it("should reject when chapter does not exist with 404 CHAPTER_NOT_FOUND", async () => {
    const service = new ChapterService();
    await assert.rejects(
      () => service.getPage("neon-valkyrie", 99, 1),
      (err: unknown) => err instanceof AppError && err.code === "CHAPTER_NOT_FOUND"
    );
  });

  it("should return HTTP 409 SOURCE_CHAPTER_EXTERNAL_ONLY with externalUrl for external chapters without downloading or writing storage", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "taphem-ext-test-"));
    try {
      const storage = new StorageService("", tempDir);
      const mockMangadex = new MockMangaDexClient();

      const customChapters = [
        {
          id: "chap_solo_1",
          mangaSlug: "na-honjaman-level-up",
          chapterNumber: 1,
          title: "The Weakest Hunter",
          pageCount: 0,
          source: "mangadex",
          sourceId: "valid-mangadex-external-chapter-id",
          externalUrl: "https://www.webnovel.com/comic/15227640605485101/45196190333068497",
          chapterType: "external" as const,
          pages: []
        }
      ];

      const chapterRepo = new StaticChapterRepository(customChapters, storage);
      const mangaRepo = new StaticMangaRepository([
        {
          id: "manga_solo",
          slug: "na-honjaman-level-up",
          title: "Na Honjaman Level-Up",
          author: "Chugong",
          artist: "DUBU",
          genres: ["Action", "Fantasy"],
          status: "completed",
          rating: 9.8,
          description: "Solo Leveling synopsis",
          coverImage: "https://example.com/cover.jpg",
          alternativeTitles: ["Solo Leveling"],
          releaseYear: 2018,
          chapterCount: 1
        }
      ]);

      const service = new ChapterService(chapterRepo, mangaRepo, storage, mockMangadex);

      await assert.rejects(
        () => service.getPage("na-honjaman-level-up", 1, 1),
        (err: unknown) => {
          assert.ok(err instanceof AppError);
          assert.equal(err.statusCode, 409);
          assert.equal(err.code, "SOURCE_CHAPTER_EXTERNAL_ONLY");
          assert.equal(
            err.externalUrl,
            "https://www.webnovel.com/comic/15227640605485101/45196190333068497"
          );
          return true;
        }
      );

      // Verify zero storage files were created
      const hasPage = await storage.hasPage("na-honjaman-level-up", 1, 1);
      assert.equal(hasPage, false);
      assert.equal(mockMangadex.downloadedUrls.length, 0);
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it("should fetch hosted page on-demand from MangaDex @Home on cache miss and write to storage cache", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "taphem-hosted-test-"));
    try {
      const storage = new StorageService("", tempDir);
      const mockMangadex = new MockMangaDexClient();

      const customChapters = [
        {
          id: "chap_hosted_1",
          mangaSlug: "hosted-manga",
          chapterNumber: 1,
          title: "Chapter 1",
          pageCount: 2,
          source: "mangadex",
          sourceId: "valid-mangadex-hosted-chapter-id",
          chapterType: "hosted" as const,
          pages: [
            { pageNumber: 1, imageUrl: "" },
            { pageNumber: 2, imageUrl: "" }
          ]
        }
      ];

      const chapterRepo = new StaticChapterRepository(customChapters, storage);
      const mangaRepo = new StaticMangaRepository([
        {
          id: "manga_hosted",
          slug: "hosted-manga",
          title: "Hosted Manga",
          author: "Author",
          artist: "Artist",
          genres: ["Action"],
          status: "completed",
          rating: 9.0,
          description: "Synopsis",
          coverImage: "https://example.com/cover.jpg",
          alternativeTitles: [],
          releaseYear: 2024,
          chapterCount: 1
        }
      ]);

      const service = new ChapterService(chapterRepo, mangaRepo, storage, mockMangadex);

      // 1. Initial request (cache miss)
      const pageResult = await service.getPage("hosted-manga", 1, 1);
      assert.ok(pageResult);
      assert.equal(pageResult.contentType, "image/jpeg");
      assert.equal(pageResult.data.toString(), "fake-jpeg-data");
      assert.equal(mockMangadex.downloadedUrls.length, 1);
      assert.equal(
        mockMangadex.downloadedUrls[0],
        "https://uploads.mangadex.org/data/abc123hash/01-page1.jpg"
      );

      // Verify file is persisted in storage cache
      const cached = await storage.readPage("hosted-manga", 1, 1);
      assert.ok(cached);
      assert.equal(cached?.contentType, "image/jpeg");
      assert.equal(cached?.data.toString(), "fake-jpeg-data");

      // 2. Second request (cache hit - should not trigger download again)
      const cachedResult = await service.getPage("hosted-manga", 1, 1);
      assert.ok(cachedResult);
      assert.equal(cachedResult.contentType, "image/jpeg");
      assert.equal(cachedResult.data.toString(), "fake-jpeg-data");
      assert.equal(mockMangadex.downloadedUrls.length, 1, "Cache hit must not download again");
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it("should handle PNG content-type from MangaDex @Home correctly", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "taphem-png-test-"));
    try {
      const storage = new StorageService("", tempDir);
      const mockMangadex = new MockMangaDexClient();

      const customChapters = [
        {
          id: "chap_hosted_1",
          mangaSlug: "hosted-manga",
          chapterNumber: 1,
          title: "Chapter 1",
          pageCount: 2,
          source: "mangadex",
          sourceId: "valid-mangadex-hosted-chapter-id",
          chapterType: "hosted" as const,
          pages: [
            { pageNumber: 1, imageUrl: "" },
            { pageNumber: 2, imageUrl: "" }
          ]
        }
      ];

      const chapterRepo = new StaticChapterRepository(customChapters, storage);
      const mangaRepo = new StaticMangaRepository([
        {
          id: "manga_hosted",
          slug: "hosted-manga",
          title: "Hosted Manga",
          author: "Author",
          artist: "Artist",
          genres: ["Action"],
          status: "completed",
          rating: 9.0,
          description: "Synopsis",
          coverImage: "https://example.com/cover.jpg",
          alternativeTitles: [],
          releaseYear: 2024,
          chapterCount: 1
        }
      ]);

      const service = new ChapterService(chapterRepo, mangaRepo, storage, mockMangadex);

      // Request Page 2 (which is 02-page2.png)
      const pageResult = await service.getPage("hosted-manga", 1, 2);
      assert.ok(pageResult);
      assert.equal(pageResult.contentType, "image/png");
      assert.equal(pageResult.data.toString(), "fake-png-data");
      assert.equal(
        mockMangadex.downloadedUrls[0],
        "https://uploads.mangadex.org/data/abc123hash/02-page2.png"
      );
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it("should set proper Cache-Control and Content-Type headers in ChapterController", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "taphem-ctrl-test-"));
    try {
      const storage = new StorageService("", tempDir);
      const mockMangadex = new MockMangaDexClient();

      const customChapters = [
        {
          id: "chap_hosted_1",
          mangaSlug: "hosted-manga",
          chapterNumber: 1,
          title: "Chapter 1",
          pageCount: 1,
          source: "mangadex",
          sourceId: "valid-mangadex-hosted-chapter-id",
          chapterType: "hosted" as const,
          pages: [{ pageNumber: 1, imageUrl: "" }]
        }
      ];

      const chapterRepo = new StaticChapterRepository(customChapters, storage);
      const mangaRepo = new StaticMangaRepository([
        {
          id: "manga_hosted",
          slug: "hosted-manga",
          title: "Hosted Manga",
          author: "Author",
          artist: "Artist",
          genres: ["Action"],
          status: "completed",
          rating: 9.0,
          description: "Synopsis",
          coverImage: "https://example.com/cover.jpg",
          alternativeTitles: [],
          releaseYear: 2024,
          chapterCount: 1
        }
      ]);

      const service = new ChapterService(chapterRepo, mangaRepo, storage, mockMangadex);
      const controller = new ChapterController(service);

      const headers: Record<string, string | number> = {};
      let responseBody: Buffer | null = null;

      const mockReq = {
        params: {
          slug: "hosted-manga",
          chapterNumber: "1",
          pageNumber: "1"
        }
      } as unknown as Request;

      const mockRes = {
        setHeader(name: string, value: string | number) {
          headers[name] = value;
        },
        end(data: Buffer) {
          responseBody = data;
        }
      } as unknown as Response;

      let nextCalled = false;
      await controller.getPage(mockReq, mockRes, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, false);
      assert.equal(headers["Content-Type"], "image/jpeg");
      assert.equal(headers["Cache-Control"], "public, max-age=31536000, immutable");
      assert.equal(headers["Content-Length"], 14);
      assert.ok(responseBody);
      assert.equal((responseBody as Buffer).toString(), "fake-jpeg-data");
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it("should isolate source IDs between different manga titles", async () => {
    const storage = new StorageService("https://cdn.example.com");
    const chapters = [
      {
        id: "chap_1",
        mangaSlug: "title-a",
        chapterNumber: 1,
        title: "Title A Ch 1",
        pageCount: 1,
        source: "mangadex",
        sourceId: "source-id-123",
        pages: [{ pageNumber: 1, imageUrl: "" }]
      },
      {
        id: "chap_2",
        mangaSlug: "title-b",
        chapterNumber: 1,
        title: "Title B Ch 1",
        pageCount: 1,
        source: "other-source",
        sourceId: "source-id-123",
        pages: [{ pageNumber: 1, imageUrl: "" }]
      }
    ];

    const repo = new StaticChapterRepository(chapters, storage);
    const chapA = await repo.findByMangaSlugAndChapterNumber("title-a", 1);
    const chapB = await repo.findByMangaSlugAndChapterNumber("title-b", 1);

    assert.equal(chapA?.source, "mangadex");
    assert.equal(chapB?.source, "other-source");
    assert.equal(chapA?.sourceId, "source-id-123");
    assert.equal(chapB?.sourceId, "source-id-123");
  });
});
