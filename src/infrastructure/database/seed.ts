import { getClient, closePool, isDatabaseConfigured } from "./pool.js";
import { SEED_MANGA } from "../../modules/manga/data/manga.data.js";
import { SEED_CHAPTERS } from "../../modules/chapter/data/chapter.data.js";

/**
 * Seeds the PostgreSQL database with the existing catalog and chapter datasets.
 */
export async function seedDatabase(): Promise<void> {
  if (!isDatabaseConfigured()) {
    console.error("DATABASE_URL is not set. Cannot seed database.");
    process.exit(1);
  }

  const client = await getClient();

  try {
    console.log("\nStarting database seeding...");
    await client.query("BEGIN");

    // 1. Seed Manga Records
    console.log(`Seeding ${SEED_MANGA.length} manga records...`);
    for (const manga of SEED_MANGA) {
      await client.query(
        `
        INSERT INTO mangas (
          id, slug, title, alternative_titles, author, artist,
          description, cover_image, genres, status, rating,
          release_year, chapter_count, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
        ON CONFLICT (id) DO UPDATE SET
          slug = EXCLUDED.slug,
          title = EXCLUDED.title,
          alternative_titles = EXCLUDED.alternative_titles,
          author = EXCLUDED.author,
          artist = EXCLUDED.artist,
          description = EXCLUDED.description,
          cover_image = EXCLUDED.cover_image,
          genres = EXCLUDED.genres,
          status = EXCLUDED.status,
          rating = EXCLUDED.rating,
          release_year = EXCLUDED.release_year,
          chapter_count = EXCLUDED.chapter_count,
          updated_at = NOW();
      `,
        [
          manga.id,
          manga.slug,
          manga.title,
          manga.alternativeTitles,
          manga.author,
          manga.artist,
          manga.description,
          manga.coverImage,
          manga.genres,
          manga.status,
          manga.rating,
          manga.releaseYear,
          manga.chapterCount
        ]
      );
    }

    // 2. Seed Chapters and Chapter Pages
    console.log(`Seeding ${SEED_CHAPTERS.length} chapter records with pages...`);
    for (const chapter of SEED_CHAPTERS) {
      // Find manga_id for chapter's mangaSlug
      const mangaRes = await client.query(
        "SELECT id FROM mangas WHERE slug = $1",
        [chapter.mangaSlug]
      );

      if (mangaRes.rows.length === 0) {
        console.warn(
          `Skipping chapter ${chapter.id}: manga with slug '${chapter.mangaSlug}' not found.`
        );
        continue;
      }

      const mangaId = mangaRes.rows[0].id;

      await client.query(
        `
        INSERT INTO chapters (
          id, manga_id, chapter_number, title, page_count, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, COALESCE($6::timestamptz, NOW()), NOW())
        ON CONFLICT (id) DO UPDATE SET
          manga_id = EXCLUDED.manga_id,
          chapter_number = EXCLUDED.chapter_number,
          title = EXCLUDED.title,
          page_count = EXCLUDED.page_count,
          updated_at = NOW();
      `,
        [
          chapter.id,
          mangaId,
          chapter.chapterNumber,
          chapter.title,
          chapter.pageCount,
          chapter.createdAt || null
        ]
      );

      // Seed pages for this chapter
      for (const page of chapter.pages) {
        const pageId = `${chapter.id}_p${page.pageNumber}`;
        await client.query(
          `
          INSERT INTO chapter_pages (
            id, chapter_id, page_number, image_path, created_at
          ) VALUES ($1, $2, $3, $4, NOW())
          ON CONFLICT (id) DO UPDATE SET
            image_path = EXCLUDED.image_path;
        `,
          [pageId, chapter.id, page.pageNumber, page.imageUrl]
        );
      }
    }

    await client.query("COMMIT");
    console.log("Database seeding completed successfully.\n");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Database seeding failed:", error);
    process.exit(1);
  } finally {
    client.release();
    await closePool();
  }
}

// Execute directly when run as script
const isDirectExecution =
  process.argv[1] &&
  (process.argv[1].endsWith("seed.ts") || process.argv[1].endsWith("seed.js"));

if (isDirectExecution) {
  seedDatabase().catch((err) => {
    console.error("Fatal seed error:", err);
    process.exit(1);
  });
}
