import { createRequire } from 'node:module';
import { AsyncLocalStorage } from 'node:async_hooks';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const txStore = new AsyncLocalStorage();

let driver = null;

/**
 * Connects to Postgres in production (DATABASE_URL) and to an embedded
 * PGlite database on disk during local development.
 */
export async function initDb() {
  if (driver) return driver;

  if (process.env.DATABASE_URL) {
    const pg = require('pg');
    const pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: Number(process.env.PG_POOL_MAX || 5),
      ssl: /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL)
        ? undefined
        : { rejectUnauthorized: false },
    });
    driver = {
      kind: 'postgres',
      pool,
      query: (text, params) => pool.query(text, params),
      close: () => pool.end(),
    };
  } else {
    const { PGlite } = await import('@electric-sql/pglite');
    const dir = process.env.PGLITE_DIR || '.data/pg';
    mkdirSync(path.dirname(path.resolve(dir)), { recursive: true });
    const pg = new PGlite(dir);
    await pg.waitReady;
    driver = {
      kind: 'pglite',
      client: pg,
      query: (text, params) => pg.query(text, params),
      close: () => pg.close(),
    };
  }

  return driver;
}

export function db() {
  if (!driver) throw new Error('Database not initialised');
  return driver;
}

function activeClient() {
  return txStore.getStore() || null;
}

export async function query(text, params = []) {
  const client = activeClient();
  const result = client ? await client.query(text, params) : await driver.query(text, params);
  return result.rows || [];
}

export async function queryOne(text, params = []) {
  const rows = await query(text, params);
  return rows[0] || null;
}

/**
 * Runs a callback inside a transaction. On Postgres the transaction gets a
 * dedicated pooled client, and AsyncLocalStorage routes the shared query
 * helpers inside the callback to that client so handlers stay simple.
 */
export async function withTx(fn) {
  if (!driver) throw new Error('Database not initialised');

  if (driver.kind === 'postgres') {
    const client = await driver.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await txStore.run(client, fn);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {
        /* connection may be gone */
      }
      throw error;
    } finally {
      client.release();
    }
  }

  const client = driver.client;
  await client.query('BEGIN');
  try {
    const result = await txStore.run(client, fn);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore rollback errors */
    }
    throw error;
  }
}

export async function closeDb() {
  if (driver) await driver.close();
  driver = null;
}
