import type { Manga, MangaRepository } from "./manga.types.js";
import { SEED_MANGA } from "./data/manga.data.js";
import { DatabaseMangaRepository } from "./manga.database.repository.js";
import { isDatabaseConfigured } from "../../infrastructure/database/pool.js";

/**
 * In-memory static implementation of the MangaRepository.
 * Useful for standalone testing and fallback operation.
 */
export class StaticMangaRepository implements MangaRepository {
  private readonly mangaList: Manga[];

  constructor(initialData: Manga[] = SEED_MANGA) {
    this.mangaList = [...initialData];
  }

  public async findAll(): Promise<Manga[]> {
    return [...this.mangaList];
  }

  public async findBySlug(slug: string): Promise<Manga | null> {
    const normalizedSlug = slug.trim().toLowerCase();
    const manga = this.mangaList.find(
      (item) => item.slug.toLowerCase() === normalizedSlug
    );
    return manga ? { ...manga } : null;
  }
}

export { DatabaseMangaRepository };

/**
 * Default repository instance: uses DatabaseMangaRepository when DATABASE_URL is configured,
 * falling back to StaticMangaRepository.
 */
export const mangaRepository: MangaRepository = isDatabaseConfigured()
  ? new DatabaseMangaRepository()
  : new StaticMangaRepository();
