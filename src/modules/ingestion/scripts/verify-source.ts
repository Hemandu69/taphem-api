import { sourceRegistry } from "../source.registry.js";
import { ingestionService } from "../ingestion.service.js";

/**
 * Manual live verification script for source adapters and source details.
 * Usage: tsx src/modules/ingestion/scripts/verify-source.ts [sourceId] [externalId]
 */
async function verifySource(): Promise<void> {
  const sourceId = process.argv[2] || "mangadex";
  const externalId = process.argv[3] || "32d76d19-8a05-4db0-9fc2-e0b0648fe9d0";

  console.log(`\n==================================================`);
  console.log(`Testing Live Source Details: [${sourceId}]`);
  console.log(`External Manga ID: [${externalId}]`);
  console.log(`==================================================\n`);

  const adapter = sourceRegistry.get(sourceId);
  if (!adapter) {
    console.error(`Error: Source '${sourceId}' is not registered.`);
    console.log(`Registered sources: ${sourceRegistry.list().map((s) => s.sourceId).join(", ")}`);
    process.exit(1);
  }

  console.log(`1. Fetching complete source manga details via IngestionService (Read-Only)...`);
  const details = await ingestionService.getSourceMangaDetails(adapter, externalId);

  console.log(`✓ Successfully retrieved source details:`);
  console.log(`   Source:            ${details.source}`);
  console.log(`   Source ID:         ${details.sourceId}`);
  console.log(`   Slug:              ${details.slug}`);
  console.log(`   Title:             ${details.title}`);
  console.log(`   Author:            ${details.author}`);
  console.log(`   Artist:            ${details.artist}`);
  console.log(`   Status:            ${details.status}`);
  console.log(`   Year:              ${details.releaseYear || "N/A"}`);
  console.log(`   Genres:            ${(details.genres || []).join(", ") || "None"}`);
  console.log(`   Cover Image:       ${details.coverImage || "None"}`);
  console.log(`   Alt Titles Count:  ${(details.alternativeTitles || []).length}`);
  console.log(`   Ingested in DB:    ${details.ingested} (mangaId: ${details.mangaId || "null"})`);
  console.log(`   Chapters count:    ${details.chapters.length}`);

  if (details.chapters.length > 0) {
    console.log(`   First chapter:     Chapter ${details.chapters[0]?.chapterNumber} - "${details.chapters[0]?.title}" (${details.chapters[0]?.pageCount} pages)`);
    console.log(`   Last chapter:      Chapter ${details.chapters[details.chapters.length - 1]?.chapterNumber} - "${details.chapters[details.chapters.length - 1]?.title}" (${details.chapters[details.chapters.length - 1]?.pageCount} pages)`);
  }

  console.log(`\n==================================================`);
  console.log(`Live Source Verification Completed Successfully.`);
  console.log(`==================================================\n`);
}

verifySource().catch((err) => {
  console.error("Live source verification failed:", err);
  process.exit(1);
});
