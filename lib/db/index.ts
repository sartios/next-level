import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

let pool: Pool | null = null;
let dbInstance: NodePgDatabase<typeof schema> | null = null;

/**
 * Get the database instance.
 * Returns null if DATABASE_URL is not set.
 */
export function getDb(): NodePgDatabase<typeof schema> | null {
  if (!dbInstance && process.env.DATABASE_URL) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000
    });
    dbInstance = drizzle(pool, { schema });
  }

  return dbInstance;
}

/**
 * Get the database instance, throwing if not configured.
 * Use this when database access is required.
 */
export function requireDb(): NodePgDatabase<typeof schema> {
  const db = getDb();
  if (!db) {
    throw new Error('DATABASE_URL environment variable is not set');
  }
  return db;
}

export async function closeConnection() {
  if (pool) {
    await pool.end();
    pool = null;
    dbInstance = null;
  }
}

export { schema };
