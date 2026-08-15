import { sourceRegistry } from "../source.registry.js";

/**
 * Manual live search discovery CLI script for source adapters.
 * Usage: tsx src/modules/ingestion/scripts/search-source.ts <sourceId> <query> [page] [limit]
 * Example: npm run source:search -- mangadex "solo leveling" 1 10
 */
async function searchSource(): Promise<void> {
  const sourceId = process.argv[2] || "mangadex";
  const query = process.argv[3];
  const page = parseInt(process.argv[4] || "1", 10);
  const limit = parseInt(process.argv[5] || "10", 10);

  if (!query || !query.trim()) {
    console.error("Usage: npm run source:search -- <sourceId> \"<search query>\" [page] [limit]");
    console.error("Example: npm run source:search -- mangadex \"solo leveling\" 1 10");
    process.exit(1);
  }

  console.log(`\n==================================================`);
  console.log(`Searching Source: [${sourceId}]`);
  console.log(`Query:            "${query}"`);
  console.log(`Page:             ${page} (Limit: ${limit})`);
  console.log(`==================================================\n`);

  const adapter = sourceRegistry.get(sourceId);
  if (!adapter) {
    console.error(`Error: Source '${sourceId}' is not registered.`);
    console.log(`Registered sources: ${sourceRegistry.list().map((s) => s.sourceId).join(", ")}`);
    process.exit(1);
  }

  if (typeof adapter.searchManga !== "function") {
    console.error(`Error: Source '${sourceId}' does not implement search capability.`);
    process.exit(1);
  }

  const results = await adapter.searchManga(query.trim(), { page, limit });

  console.log(`✓ Search returned ${results.items.length} items (Total matches: ${results.pagination.total}):\n`);

  results.items.forEach((item, index) => {
    const num = (page - 1) * limit + index + 1;
    console.log(`[${num}] ${item.title}`);
    console.log(`    Source ID:    ${item.sourceId}`);
    console.log(`    Slug:         ${item.slug}`);
    console.log(`    Author:       ${item.author || "Unknown"}`);
    console.log(`    Genres:       ${(item.genres || []).join(", ") || "None"}`);
    console.log(`    Status:       ${item.status || "ongoing"}`);
    console.log(`    Year:         ${item.releaseYear || "N/A"}`);
    console.log(`    Cover URL:    ${item.coverImage || "None"}`);
    console.log("");
  });

  console.log(`==================================================`);
  console.log(`Pagination: Page ${results.pagination.page} | Limit ${results.pagination.limit} | Total ${results.pagination.total} | Has Next: ${results.pagination.hasNextPage}`);
  console.log(`Note: Search results are NOT persisted to PostgreSQL.`);
  console.log(`==================================================\n`);
}

searchSource().catch((err) => {
  console.error("Search failed:", err);
  process.exit(1);
});
