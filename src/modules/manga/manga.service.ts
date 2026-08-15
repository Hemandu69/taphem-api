import type { Manga, MangaRepository } from "./manga.types.js";
import { mangaRepository } from "./manga.repository.js";
import { AppError } from "../../utils/errors.js";

/**
 * Service handling Manga business logic and validation.
 */
export class MangaService {
  constructor(private readonly repository: MangaRepository = mangaRepository) {}

  /**
   * Retrieves all manga records in the catalog.
   */
  public async getAllManga(): Promise<Manga[]> {
    return this.repository.findAll();
  }

  /**
   * Retrieves a single manga by its URL slug.
   * Throws AppError with MANGA_NOT_FOUND code if not found.
   */
  public async getMangaBySlug(slug: string): Promise<Manga> {
    const trimmedSlug = slug?.trim();
    if (!trimmedSlug) {
      throw AppError.badRequest("Manga slug parameter is required", "INVALID_SLUG");
    }

    const manga = await this.repository.findBySlug(trimmedSlug);
    if (!manga) {
      throw AppError.notFound(`Manga '${trimmedSlug}' was not found`, "MANGA_NOT_FOUND");
    }

    return manga;
  }
}

export const mangaService = new MangaService();
