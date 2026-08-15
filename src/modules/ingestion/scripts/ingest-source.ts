import { sourceRegistry } from "../source.registry.js";
import { ingestionService } from "../ingestion.service.js";

/**
 * Manual CLI command to ingest a manga from any registered source adapter.
 * Usage: tsx src/modules/ingestion/scripts/ingest-source.ts <sourceId> <externalId>
 */
async function ingestSource(): Promise<void> {
  const sourceId = process.argv[2];
  const externalId = process.argv[3];

  if (!sourceId || !externalId) {
    console.error("Usage: npm run source:ingest -- <sourceId> <externalId>");
    console.error("Example: npm run source:ingest -- mangadex 32d76d19-8a05-4db0-9fc2-e0b0648fe9d0");
    process.exit(1);
  }

  const adapter = sourceRegistry.get(sourceId);
  if (!adapter) {
    console.error(`Error: Source '${sourceId}' is not registered.`);
    console.log(`Registered sources: ${sourceRegistry.list().map((s) => s.sourceId).join(", ")}`);
    process.exit(1);
  }

  console.log(`\nStarting ingestion from source [${adapter.sourceName}] for ID [${externalId}]...`);

  const result = await ingestionService.ingestFromAdapter(adapter, externalId);

  console.log(`\n==================================================`);
  console.log(`Ingestion Result:`);
  console.log(`==================================================`);
  console.log(`Action:            ${result.action}`);
  console.log(`Manga ID:          ${result.mangaId}`);
  console.log(`Slug:              ${result.slug}`);
  console.log(`Title:             ${result.title}`);
  console.log(`Chapters Ingested: ${result.chaptersCount}`);
  console.log(`Genres Linked:     ${result.genresCount}`);
  console.log(`==================================================\n`);
}

ingestSource().catch((err) => {
  console.error("Ingestion failed:", err);
  process.exit(1);
});
