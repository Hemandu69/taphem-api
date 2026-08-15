import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { StaticMangaRepository, DatabaseMangaRepository } from "./manga.repository.js";
import { SEED_MANGA } from "./data/manga.data.js";

describe("Manga Repository", () => {
  it("should return all seed manga records from static repository", async () => {
    const repo = new StaticMangaRepository();
    const mangas = await repo.findAll();
    assert.equal(mangas.length, SEED_MANGA.length);
    assert.equal(mangas[0]?.slug, "echoes-of-the-abyss");
  });

  it("should find manga by valid slug (case-insensitive) and preserve genres array", async () => {
    const repo = new StaticMangaRepository();
    const manga = await repo.findBySlug("NEON-VALKYRIE");
    assert.ok(manga);
    assert.equal(manga?.slug, "neon-valkyrie");
    assert.equal(manga?.title, "Neon Valkyrie");
    assert.ok(Array.isArray(manga?.genres));
    assert.ok(manga?.genres.includes("Cyberpunk"));
    assert.ok(manga?.genres.includes("Sci-Fi"));
  });

  it("should return null for non-existent manga slug", async () => {
    const repo = new StaticMangaRepository();
    const manga = await repo.findBySlug("does-not-exist");
    assert.equal(manga, null);
  });

  it("should gracefully fall back when database is offline or unconfigured", async () => {
    const fallbackRepo = new StaticMangaRepository();
    const dbRepo = new DatabaseMangaRepository(fallbackRepo);
    const mangas = await dbRepo.findAll();
    assert.ok(mangas.length >= SEED_MANGA.length);

    const single = await dbRepo.findBySlug("neon-valkyrie");
    assert.ok(single);
    assert.equal(single?.slug, "neon-valkyrie");
  });
});
