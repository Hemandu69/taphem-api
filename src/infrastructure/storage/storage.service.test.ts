import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { StorageService } from "./storage.service.js";
import { AppError } from "../../utils/errors.js";

describe("StorageService Asset URL & Path Generation", () => {
  it("should generate deterministic CDN URLs with 3-digit padded page numbers", () => {
    const storage = new StorageService("https://cdn-beta.example.com");
    const url = storage.resolveChapterPageUrl("neon-valkyrie", 1, 3);
    assert.equal(
      url,
      "https://cdn-beta.example.com/manga/neon-valkyrie/chapters/1/003.webp"
    );
  });

  it("should properly strip trailing slashes from the CDN base URL", () => {
    const storage = new StorageService("https://cdn-beta.example.com///");
    const url = storage.resolveChapterPageUrl("neon-valkyrie", 2, 1);
    assert.equal(
      url,
      "https://cdn-beta.example.com/manga/neon-valkyrie/chapters/2/001.webp"
    );
  });

  it("should correctly pad single, double, and triple digit page numbers", () => {
    const storage = new StorageService("https://cdn.example.com");
    assert.equal(
      storage.getChapterPagePath("echoes-of-the-abyss", 5, 1),
      "manga/echoes-of-the-abyss/chapters/5/001.webp"
    );
    assert.equal(
      storage.getChapterPagePath("echoes-of-the-abyss", 5, 42),
      "manga/echoes-of-the-abyss/chapters/5/042.webp"
    );
    assert.equal(
      storage.getChapterPagePath("echoes-of-the-abyss", 5, 108),
      "manga/echoes-of-the-abyss/chapters/5/108.webp"
    );
  });

  it("should return fallback URL when CDN base URL is empty and fallback is provided", () => {
    const storage = new StorageService("");
    const fallback = "https://images.unsplash.com/photo-12345";
    const url = storage.resolveChapterPageUrl("neon-valkyrie", 1, 1, fallback);
    assert.equal(url, fallback);
  });

  it("should return API delivery endpoint when CDN base URL is empty and no fallback is provided", () => {
    const storage = new StorageService("");
    const url = storage.resolveChapterPageUrl("neon-valkyrie", 1, 1);
    assert.equal(url, "/api/v1/manga/neon-valkyrie/chapters/1/pages/1");
  });

  it("should reject malicious path traversal in manga slug", () => {
    const storage = new StorageService("https://cdn.example.com");

    assert.throws(
      () => storage.getChapterPagePath("../etc/passwd", 1, 1),
      (err: unknown) => err instanceof AppError && err.code === "INVALID_SLUG"
    );
    assert.throws(
      () => storage.getChapterPagePath("manga/../../secret", 1, 1),
      (err: unknown) => err instanceof AppError && err.code === "INVALID_SLUG"
    );
    assert.throws(
      () => storage.getChapterPagePath("manga%2e%2eslug", 1, 1),
      (err: unknown) => err instanceof AppError && err.code === "INVALID_SLUG"
    );
    assert.throws(
      () => storage.getChapterPagePath("invalid_underscore_slug", 1, 1),
      (err: unknown) => err instanceof AppError && err.code === "INVALID_SLUG"
    );
  });

  it("should reject invalid chapter and page numbers", () => {
    const storage = new StorageService("https://cdn.example.com");

    assert.throws(
      () => storage.getChapterPagePath("neon-valkyrie", 0, 1),
      (err: unknown) =>
        err instanceof AppError && err.code === "INVALID_CHAPTERNUMBER"
    );
    assert.throws(
      () => storage.getChapterPagePath("neon-valkyrie", -5, 1),
      (err: unknown) =>
        err instanceof AppError && err.code === "INVALID_CHAPTERNUMBER"
    );
    assert.throws(
      () => storage.getChapterPagePath("neon-valkyrie", 1.5, 1),
      (err: unknown) =>
        err instanceof AppError && err.code === "INVALID_CHAPTERNUMBER"
    );
    assert.throws(
      () => storage.getChapterPagePath("neon-valkyrie", 1, 0),
      (err: unknown) =>
        err instanceof AppError && err.code === "INVALID_PAGENUMBER"
    );
    assert.throws(
      () => storage.getChapterPagePath("neon-valkyrie", 1, -1),
      (err: unknown) =>
        err instanceof AppError && err.code === "INVALID_PAGENUMBER"
    );
  });

  it("should write, read, and check existence of binary page assets", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "taphem-storage-test-"));
    try {
      const storage = new StorageService("", tempDir);
      const testBuffer = Buffer.from("fake-jpeg-binary-data");

      // Verify page does not exist initially
      const initialHas = await storage.hasPage("solo-leveling", 1, 1);
      assert.equal(initialHas, false);
      const initialRead = await storage.readPage("solo-leveling", 1, 1);
      assert.equal(initialRead, null);

      // Write page with JPEG content type
      const savedPath = await storage.writePage(
        "solo-leveling",
        1,
        1,
        testBuffer,
        "image/jpeg"
      );
      assert.equal(savedPath, "manga/solo-leveling/chapters/1/001.jpg");

      // Verify page exists
      const afterHas = await storage.hasPage("solo-leveling", 1, 1);
      assert.equal(afterHas, true);

      // Read page and verify content
      const readResult = await storage.readPage("solo-leveling", 1, 1);
      assert.ok(readResult);
      assert.equal(readResult?.contentType, "image/jpeg");
      assert.equal(readResult?.data.toString(), "fake-jpeg-binary-data");
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });
});
