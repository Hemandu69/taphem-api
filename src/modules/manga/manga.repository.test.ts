import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { StaticMangaRepository } from "./manga.repository.js";
import { SEED_MANGA } from "./data/manga.data.js";

describe("Manga Repository", () => {
  it("should return all seed manga records from static repository", async () => {
    const repo = new StaticMangaRepository();
    const mangas = await repo.findAll();
    assert.equal(mangas.length, SEED_MANGA.length);
    assert.equal(mangas[0]?.slug, "echoes-of-the-abyss");
  });

  it("should find manga by valid slug (case-insensitive)", async () => {
    const repo = new StaticMangaRepository();
    const manga = await repo.findBySlug("NEON-VALKYRIE");
    assert.ok(manga);
    assert.equal(manga?.slug, "neon-valkyrie");
    assert.equal(manga?.title, "Neon Valkyrie");
  });

  it("should return null for non-existent manga slug", async () => {
    const repo = new StaticMangaRepository();
    const manga = await repo.findBySlug("does-not-exist");
    assert.equal(manga, null);
  });
});
