import { sourceRegistry } from "../source.registry.js";

/**
 * Manual live verification script for source adapters.
 * Usage: tsx src/modules/ingestion/scripts/verify-source.ts [sourceId] [externalId]
 */
async function verifySource(): Promise<void> {
  const sourceId = process.argv[2] || "mangadex";
  // Default MangaDex UUID for verification: "a1c7c817-4e59-42b5-bd33-02041e32329a" (One Piece) or "32d76d19-8a05-4db0-9fc2-e0b0648fe9d0" (Solo Leveling)
  const externalId = process.argv[3] || "32d76d19-8a05-4db0-9fc2-e0b0648fe9d0";

  console.log(`\n==================================================`);
  console.log(`Testing Live Source Adapter: [${sourceId}]`);
  console.log(`External Manga ID: [${externalId}]`);
  console.log(`==================================================\n`);

  const adapter = sourceRegistry.get(sourceId);
  if (!adapter) {
    console.error(`Error: Source '${sourceId}' is not registered.`);
    console.log(`Registered sources: ${sourceRegistry.list().map((s) => s.sourceId).join(", ")}`);
    process.exit(1);
  }

  console.log(`1. Fetching manga metadata from ${adapter.sourceName}...`);
  const manga = await adapter.fetchManga(externalId);

  if (!manga) {
    console.error(`Manga with external ID '${externalId}' was not found on '${adapter.sourceName}'.`);
    process.exit(1);
  }

  console.log(`✓ Successfully fetched manga:`);
  console.log(`   Title:             ${manga.title}`);
  console.log(`   Author:            ${manga.author}`);
  console.log(`   Artist:            ${manga.artist}`);
  console.log(`   Status:            ${manga.status}`);
  console.log(`   Year:              ${manga.releaseYear || "N/A"}`);
  console.log(`   Genres:            ${(manga.genres || []).join(", ") || "None"}`);
  console.log(`   Cover Image:       ${manga.coverImage || "None"}`);
  console.log(`   Alt Titles Count:  ${(manga.alternativeTitles || []).length}`);

  console.log(`\n2. Fetching chapter list from ${adapter.sourceName}...`);
  const chapters = await adapter.fetchChapters(externalId);

  console.log(`✓ Successfully fetched ${chapters.length} chapters.`);
  if (chapters.length > 0) {
    console.log(`   First chapter:     Chapter ${chapters[0]?.chapterNumber} - "${chapters[0]?.title}" (${chapters[0]?.pageCount} pages)`);
    console.log(`   Last chapter:      Chapter ${chapters[chapters.length - 1]?.chapterNumber} - "${chapters[chapters.length - 1]?.title}" (${chapters[chapters.length - 1]?.pageCount} pages)`);
  }

  console.log(`\n==================================================`);
  console.log(`Live Source Verification Completed Successfully.`);
  console.log(`==================================================\n`);
}

verifySource().catch((err) => {
  console.error("Live source verification failed:", err);
  process.exit(1);
});
