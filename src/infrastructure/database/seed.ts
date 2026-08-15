import { getClient, closePool, isDatabaseConfigured } from "./pool.js";
import { SEED_MANGA } from "../../modules/manga/data/manga.data.js";
import { SEED_CHAPTERS } from "../../modules/chapter/data/chapter.data.js";

/**
 * Helper to convert genre name into a clean, predictable URL slug.
 */
function slugifyGenre(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Seeds the PostgreSQL database with the normalized manga, genre, and chapter datasets.
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

    // Check if legacy mangas.genres column exists
    const columnCheck = await client.query(`
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'mangas' AND column_name = 'genres';
    `);
    const hasLegacyGenresColumn = columnCheck.rows.length > 0;

    // 1. Seed Manga Metadata Records
    console.log(`Seeding ${SEED_MANGA.length} manga records...`);
    for (const manga of SEED_MANGA) {
      if (hasLegacyGenresColumn) {
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
      } else {
        await client.query(
          `
          INSERT INTO mangas (
            id, slug, title, alternative_titles, author, artist,
            description, cover_image, status, rating,
            release_year, chapter_count, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
          ON CONFLICT (id) DO UPDATE SET
            slug = EXCLUDED.slug,
            title = EXCLUDED.title,
            alternative_titles = EXCLUDED.alternative_titles,
            author = EXCLUDED.author,
            artist = EXCLUDED.artist,
            description = EXCLUDED.description,
            cover_image = EXCLUDED.cover_image,
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
            manga.status,
            manga.rating,
            manga.releaseYear,
            manga.chapterCount
          ]
        );
      }
    }

    // 2. Check if normalized genres table exists
    const genresTableCheck = await client.query(`
      SELECT 1
      FROM information_schema.tables
      WHERE table_name = 'genres';
    `);

    if (genresTableCheck.rows.length > 0) {
      console.log("Seeding normalized genres and manga_genres relationships...");

      // Collect all distinct genres across all manga
      const genreMap = new Map<string, string>(); // slug -> name
      for (const manga of SEED_MANGA) {
        for (const genreName of manga.genres) {
          const slug = slugifyGenre(genreName);
          if (slug && !genreMap.has(slug)) {
            genreMap.set(slug, genreName.trim());
          }
        }
      }

      // Upsert genres and track their generated IDs
      const genreIdBySlug = new Map<string, number>();
      for (const [slug, name] of genreMap.entries()) {
        const res = await client.query<{ id: number }>(
          `
          INSERT INTO genres (slug, name)
          VALUES ($1, $2)
          ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
          RETURNING id;
        `,
          [slug, name]
        );
        if (res.rows[0]) {
          genreIdBySlug.set(slug, res.rows[0].id);
        }
      }

      // Populate manga_genres relations
      for (const manga of SEED_MANGA) {
        for (const genreName of manga.genres) {
          const slug = slugifyGenre(genreName);
          const genreId = genreIdBySlug.get(slug);
          if (genreId) {
            await client.query(
              `
              INSERT INTO manga_genres (manga_id, genre_id)
              VALUES ($1, $2)
              ON CONFLICT (manga_id, genre_id) DO NOTHING;
            `,
              [manga.id, genreId]
            );
          }
        }
      }
    }

    // 3. Seed Chapters
    console.log(`Seeding ${SEED_CHAPTERS.length} chapter records...`);
    for (const chapter of SEED_CHAPTERS) {
      const mangaRes = await client.query<{ id: string }>(
        "SELECT id FROM mangas WHERE slug = $1",
        [chapter.mangaSlug]
      );

      if (mangaRes.rows.length === 0) {
        console.warn(
          `Skipping chapter ${chapter.id}: manga with slug '${chapter.mangaSlug}' not found.`
        );
        continue;
      }

      const mangaRow = mangaRes.rows[0];
      if (!mangaRow) continue;
      const mangaId = mangaRow.id;

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
