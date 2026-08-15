import { describe, it } from "node:test";
import assert from "node:assert/strict";
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

  it("should return root-relative path when CDN base URL is empty and no fallback is provided", () => {
    const storage = new StorageService("");
    const url = storage.resolveChapterPageUrl("neon-valkyrie", 1, 1);
    assert.equal(url, "/manga/neon-valkyrie/chapters/1/001.webp");
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
});
