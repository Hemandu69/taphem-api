import pg, { type PoolClient, type QueryResult, type QueryResultRow } from "pg";
import { config } from "../../config/index.js";

const { Pool } = pg;

let poolInstance: pg.Pool | null = null;

/**
 * Determines whether database configuration is provided.
 */
export function isDatabaseConfigured(): boolean {
  return Boolean(config.databaseUrl && config.databaseUrl.trim().length > 0);
}

/**
 * Returns the shared PostgreSQL connection pool singleton.
 * Returns null if DATABASE_URL is not configured.
 */
export function getPool(): pg.Pool | null {
  if (!isDatabaseConfigured()) {
    return null;
  }

  if (!poolInstance) {
    const isSslRequired =
      config.isProduction ||
      config.databaseUrl.includes("sslmode=require") ||
      config.databaseUrl.includes("render.com") ||
      config.databaseUrl.includes("supabase.co") ||
      config.databaseUrl.includes("neon.tech");

    poolInstance = new Pool({
      connectionString: config.databaseUrl,
      ssl: isSslRequired ? { rejectUnauthorized: false } : undefined,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000
    });

    poolInstance.on("error", (err: Error) => {
      console.error("Unexpected error on idle PostgreSQL client:", err);
    });
  }

  return poolInstance;
}

/**
 * Helper to execute a parameterized SQL query with automatic client release.
 */
export async function query<R extends QueryResultRow = QueryResultRow, I = unknown[]>(
  text: string,
  params?: I
): Promise<QueryResult<R>> {
  const pool = getPool();
  if (!pool) {
    throw new Error(
      "DATABASE_URL is not configured. Cannot execute database query."
    );
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return pool.query<R>(text, params as any);
}

/**
 * Acquires a client from the pool (for transactions).
 */
export async function getClient(): Promise<PoolClient> {
  const pool = getPool();
  if (!pool) {
    throw new Error(
      "DATABASE_URL is not configured. Cannot acquire database client."
    );
  }
  return pool.connect();
}

/**
 * Closes the database pool gracefully (for shutdown / testing).
 */
export async function closePool(): Promise<void> {
  if (poolInstance) {
    await poolInstance.end();
    poolInstance = null;
  }
}
