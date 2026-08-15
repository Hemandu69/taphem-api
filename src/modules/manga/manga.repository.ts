import type { Manga, MangaRepository } from "./manga.types.js";
import { SEED_MANGA } from "./data/manga.data.js";

/**
 * In-memory static implementation of the MangaRepository.
 * Designed to be swapped seamlessly with DatabaseMangaRepository in future iterations.
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

export const mangaRepository = new StaticMangaRepository();
