import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getClient, closePool, isDatabaseConfigured } from "./pool.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Runs SQL database migrations.
 */
export async function runMigrations(direction: "up" | "down" = "up"): Promise<void> {
  if (!isDatabaseConfigured()) {
    console.error("DATABASE_URL is not set. Cannot run migrations.");
    process.exit(1);
  }

  const client = await getClient();

  try {
    console.log(`\nStarting database migration [${direction}]...`);
    await client.query("BEGIN");

    // Create migrations tracker table
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const migrationsDir = path.join(__dirname, "migrations");
    const files = fs.readdirSync(migrationsDir).sort();

    if (direction === "up") {
      const upFiles = files.filter(
        (f) => f.endsWith(".sql") && !f.endsWith(".down.sql")
      );

      for (const file of upFiles) {
        const version = file.replace(".sql", "");
        const check = await client.query(
          "SELECT version FROM schema_migrations WHERE version = $1",
          [version]
        );

        if (check.rows.length === 0) {
          console.log(`Applying migration: ${file}`);
          const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
          await client.query(sql);
          await client.query(
            "INSERT INTO schema_migrations (version) VALUES ($1)",
            [version]
          );
          console.log(`Applied migration: ${file}`);
        } else {
          console.log(`Skipping already applied migration: ${file}`);
        }
      }
    } else {
      const downFiles = files
        .filter((f) => f.endsWith(".down.sql"))
        .reverse();

      for (const file of downFiles) {
        const version = file.replace(".down.sql", "");
        console.log(`Rolling back migration: ${file}`);
        const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
        await client.query(sql);
        await client.query(
          "DELETE FROM schema_migrations WHERE version = $1",
          [version]
        );
        console.log(`Rolled back migration: ${file}`);
      }
    }

    await client.query("COMMIT");
    console.log(`\nDatabase migration [${direction}] completed successfully.`);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    client.release();
    await closePool();
  }
}

// Execute directly when run as script
const isDirectExecution =
  process.argv[1] &&
  (process.argv[1].endsWith("migrate.ts") || process.argv[1].endsWith("migrate.js"));

if (isDirectExecution) {
  const direction = process.argv[2] === "down" ? "down" : "up";
  runMigrations(direction).catch((err) => {
    console.error("Fatal migration error:", err);
    process.exit(1);
  });
}
