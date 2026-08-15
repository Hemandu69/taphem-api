import type { MangaSourceAdapter } from "./source-adapter.types.js";
import { MangaDexAdapter } from "./adapters/mangadex/mangadex.adapter.js";

/**
 * Registry managing all configured external content source adapters.
 */
export class SourceRegistry {
  private readonly adapters = new Map<string, MangaSourceAdapter>();

  constructor() {
    // Automatically register default real adapters
    this.register(new MangaDexAdapter());
  }

  /**
   * Registers a new or custom source adapter.
   */
  public register(adapter: MangaSourceAdapter): void {
    if (!adapter || !adapter.sourceId) {
      throw new Error("Cannot register invalid source adapter");
    }
    this.adapters.set(adapter.sourceId.toLowerCase(), adapter);
  }

  /**
   * Retrieves an adapter by its unique source identifier.
   */
  public get(sourceId: string): MangaSourceAdapter | undefined {
    return this.adapters.get(sourceId.trim().toLowerCase());
  }

  /**
   * Checks whether a source is registered.
   */
  public has(sourceId: string): boolean {
    return this.adapters.has(sourceId.trim().toLowerCase());
  }

  /**
   * Returns all registered adapters.
   */
  public list(): MangaSourceAdapter[] {
    return Array.from(this.adapters.values());
  }
}

export const sourceRegistry = new SourceRegistry();
