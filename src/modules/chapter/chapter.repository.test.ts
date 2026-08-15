import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { StaticChapterRepository, DatabaseChapterRepository } from "./chapter.repository.js";
import { StorageService } from "../../infrastructure/storage/storage.service.js";

describe("Chapter Repository", () => {
  it("should retrieve chapter summaries for neon-valkyrie sorted by chapter number", async () => {
    const repo = new StaticChapterRepository();
    const chapters = await repo.findByMangaSlug("neon-valkyrie");
    assert.equal(chapters.length, 3);
    assert.equal(chapters[0]?.chapterNumber, 1);
    assert.equal(chapters[1]?.chapterNumber, 2);
    assert.equal(chapters[2]?.chapterNumber, 3);
  });

  it("should retrieve full chapter 1 with exactly 8 ordered pages", async () => {
    const repo = new StaticChapterRepository();
    const chapter = await repo.findByMangaSlugAndChapterNumber("neon-valkyrie", 1);
    assert.ok(chapter);
    assert.equal(chapter?.chapterNumber, 1);
    assert.equal(chapter?.pageCount, 8);
    assert.equal(chapter?.pages.length, 8);
    assert.equal(chapter?.pages[0]?.pageNumber, 1);
    assert.equal(chapter?.pages[7]?.pageNumber, 8);
  });

  it("should resolve CDN URLs when storage service has CDN configured", async () => {
    const storage = new StorageService("https://cdn-beta.example.com");
    const repo = new StaticChapterRepository(undefined, storage);
    const chapter = await repo.findByMangaSlugAndChapterNumber("neon-valkyrie", 1);
    assert.ok(chapter);
    assert.equal(
      chapter?.pages[0]?.imageUrl,
      "https://cdn-beta.example.com/manga/neon-valkyrie/chapters/1/001.webp"
    );
    assert.equal(
      chapter?.pages[7]?.imageUrl,
      "https://cdn-beta.example.com/manga/neon-valkyrie/chapters/1/008.webp"
    );
  });

  it("should return null when chapter is not found", async () => {
    const repo = new StaticChapterRepository();
    const chapter = await repo.findByMangaSlugAndChapterNumber("neon-valkyrie", 999);
    assert.equal(chapter, null);
  });

  it("should support fallback operation on DatabaseChapterRepository", async () => {
    const storage = new StorageService("https://cdn-beta.example.com");
    const fallback = new StaticChapterRepository(undefined, storage);
    const dbRepo = new DatabaseChapterRepository(storage, fallback);

    const summaries = await dbRepo.findByMangaSlug("neon-valkyrie");
    assert.equal(summaries.length, 3);

    const chapter = await dbRepo.findByMangaSlugAndChapterNumber("neon-valkyrie", 1);
    assert.ok(chapter);
    assert.equal(chapter?.pages.length, 8);
    assert.equal(
      chapter?.pages[0]?.imageUrl,
      "https://cdn-beta.example.com/manga/neon-valkyrie/chapters/1/001.webp"
    );
  });
});
