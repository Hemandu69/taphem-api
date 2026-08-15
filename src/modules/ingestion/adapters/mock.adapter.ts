import type {
  MangaSourceAdapter,
  SourceMangaPayload,
  SourceChapterPayload,
  SourceSearchOptions,
  SourceSearchResult,
  SourceMangaSearchItem
} from "../source-adapter.types.js";

/**
 * Deterministic Mock Adapter for testing the catalog ingestion pipeline without external network calls.
 */
export class MockMangaSourceAdapter implements MangaSourceAdapter {
  public readonly sourceId: string;
  public readonly sourceName: string;

  private readonly mangaStore = new Map<string, SourceMangaPayload>();
  private readonly chapterStore = new Map<string, SourceChapterPayload[]>();

  constructor(sourceId = "mock_source", sourceName = "Mock Manga Source") {
    this.sourceId = sourceId;
    this.sourceName = sourceName;
    this.initDefaultData();
  }

  private initDefaultData(): void {
    const mockMangaId = "mock_manga_01";
    this.mangaStore.set(mockMangaId, {
      sourceId: mockMangaId,
      title: "Neon Valkyrie",
      slug: "neon-valkyrie",
      alternativeTitles: ["네온 발키리", "ネオン・ヴァルキリー"],
      author: "Shinjiro Takahashi",
      artist: "Emi Morikawa",
      description: "In the cybernetic sprawl of 2088 Neo-Kyoto, rogue synthetic beings threaten humanity.",
      coverImage: "https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=800&q=80",
      genres: ["Cyberpunk", "Sci-Fi", "Action", "Psychological"],
      status: "ongoing",
      rating: 9.2,
      releaseYear: 2024
    });

    this.chapterStore.set(mockMangaId, [
      {
        sourceId: "mock_chap_01",
        mangaSourceId: mockMangaId,
        chapterNumber: 1,
        title: "Awakening in Neo-Kyoto",
        pageCount: 8
      },
      {
        sourceId: "mock_chap_02",
        mangaSourceId: mockMangaId,
        chapterNumber: 2,
        title: "The Syndicate's Shadow",
        pageCount: 8
      },
      {
        sourceId: "mock_chap_03",
        mangaSourceId: mockMangaId,
        chapterNumber: 3,
        title: "Protocol Zero",
        pageCount: 8
      }
    ]);
  }

  public async fetchManga(externalId: string): Promise<SourceMangaPayload | null> {
    const data = this.mangaStore.get(externalId);
    return data ? { ...data } : null;
  }

  public async fetchChapters(externalId: string): Promise<SourceChapterPayload[]> {
    const chapters = this.chapterStore.get(externalId);
    return chapters ? chapters.map((c) => ({ ...c })) : [];
  }

  public async fetchMangaDetails(externalId: string): Promise<{
    manga: SourceMangaPayload;
    chapters: SourceChapterPayload[];
  } | null> {
    const manga = await this.fetchManga(externalId);
    if (!manga) {
      return null;
    }
    const chapters = await this.fetchChapters(externalId);
    return {
      manga,
      chapters
    };
  }

  public async searchManga(
    query: string,
    options?: SourceSearchOptions
  ): Promise<SourceSearchResult> {
    const cleanQuery = (query || "").trim().toLowerCase();
    const page = Math.max(options?.page || 1, 1);
    const limit = Math.min(Math.max(options?.limit || 20, 1), 100);

    const matching: SourceMangaSearchItem[] = [];
    for (const manga of this.mangaStore.values()) {
      if (
        !cleanQuery ||
        manga.title.toLowerCase().includes(cleanQuery) ||
        (manga.slug && manga.slug.toLowerCase().includes(cleanQuery))
      ) {
        matching.push({
          source: this.sourceId,
          sourceId: manga.sourceId,
          slug: manga.slug || "mock-manga",
          title: manga.title,
          alternativeTitles: manga.alternativeTitles,
          author: manga.author,
          artist: manga.artist,
          description: manga.description,
          coverImage: manga.coverImage,
          genres: manga.genres,
          status: manga.status,
          rating: manga.rating,
          releaseYear: manga.releaseYear
        });
      }
    }

    const offset = (page - 1) * limit;
    const items = matching.slice(offset, offset + limit);
    const total = matching.length;
    const hasNextPage = offset + items.length < total;

    return {
      source: this.sourceId,
      query,
      items,
      pagination: {
        page,
        limit,
        total,
        hasNextPage
      }
    };
  }

  public setMockManga(payload: SourceMangaPayload): void {
    this.mangaStore.set(payload.sourceId, payload);
  }

  public setMockChapters(mangaSourceId: string, chapters: SourceChapterPayload[]): void {
    this.chapterStore.set(mangaSourceId, chapters);
  }
}
