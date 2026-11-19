import fs from "node:fs";
import pg from "pg";
import { PGlite, types as pgliteTypes } from "@electric-sql/pglite";
import { config, PGDATA_DIR, ENV_FILE_PATH } from "../config.js";

const { Pool, Client } = pg;

pg.types.setTypeParser(1700, (val: string) => parseFloat(val));
pg.types.setTypeParser(20, (val: string) => Number(val));

export interface QueryResultRow {
  [column: string]: any;
}

export interface DbQueryResult<T = any> {
  rows: T[];
  rowCount: number;
}

export interface DbDriver {
  mode: "pg" | "pglite";
  cloudHost?: string | null;
  query<T = any>(sql: string, params?: any[]): Promise<DbQueryResult<T>>;
  execMulti(sql: string): Promise<void>;
  close(): Promise<void>;
}

let activeDriver: DbDriver | null = null;
let initPromise: Promise<DbDriver> | null = null;

function needsCloudSsl(connectionString: string): boolean {
  return /sslmode=(require|verify-full|verify-ca|no-verify)|neon\.tech|supabase\.co|supabase\.com|railway\.app|rlwy\.net|render\.com|aivencloud\.com|cockroachlabs\.cloud/i.test(
    connectionString,
  );
}

function extractSafeHost(connectionString: string): string | null {
  try {
    const u = new URL(connectionString);
    return u.hostname || null;
  } catch {
    return null;
  }
}

async function ensureDatabaseExists(connectionString: string): Promise<void> {
  // Managed cloud Postgres (Neon / Supabase / Railway) already create the target DB
  if (needsCloudSsl(connectionString)) return;
  try {
    const u = new URL(connectionString);
    const dbName = u.pathname.replace(/^\//, "");
    if (!dbName || !/^[a-zA-Z0-9_]+$/.test(dbName)) return;
    u.pathname = "/postgres";
    const adminClient = new Client({
      connectionString: u.toString(),
      connectionTimeoutMillis: 3000,
    });
    await adminClient.connect();
    const exists = await adminClient.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
    if (exists.rowCount === 0) {
      await adminClient.query(`CREATE DATABASE "${dbName}"`);
      console.log(`[apps-db] Created PostgreSQL database "${dbName}"`);
    }
    await adminClient.end();
  } catch {
    // Ignore — main connection check handles errors
  }
}

async function createPgPoolDriver(url: string): Promise<DbDriver> {
  await ensureDatabaseExists(url);
  const useSsl = needsCloudSsl(url);
  // Strip sslmode=require from URL when passing explicit ssl object to pg.Pool to avoid pg v8 strict-cert override
  let cleanUrl = url;
  if (useSsl) {
    try {
      const parsed = new URL(url);
      parsed.searchParams.delete("sslmode");
      cleanUrl = parsed.toString();
    } catch {}
  }

  const pool = new Pool({
    connectionString: cleanUrl,
    max: 20,
    connectionTimeoutMillis: 8000,
    ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
  });

  await pool.query("SELECT 1");
  const cloudHost = extractSafeHost(url);
  console.log(`[apps-db] Connected to PostgreSQL server (${cloudHost || "external"})`);

  return {
    mode: "pg",
    cloudHost,
    async query<T = any>(sql: string, params: any[] = []): Promise<DbQueryResult<T>> {
      const res = await pool.query(sql, params);
      return { rows: res.rows as T[], rowCount: res.rowCount ?? res.rows.length };
    },
    async execMulti(sql: string): Promise<void> {
      await pool.query(sql);
    },
    async close(): Promise<void> {
      await pool.end();
    },
  };
}

async function createEmbeddedDriver(): Promise<DbDriver> {
  fs.mkdirSync(PGDATA_DIR, { recursive: true });
  const pglite = await PGlite.create(PGDATA_DIR, {
    parsers: {
      [pgliteTypes.NUMERIC]: (val: string) => parseFloat(val),
      [pgliteTypes.INT8]: (val: string) => Number(val),
    },
  });

  return {
    mode: "pglite",
    cloudHost: null,
    async query<T = any>(sql: string, params: any[] = []): Promise<DbQueryResult<T>> {
      const res = await pglite.query<T>(sql, params);
      return { rows: res.rows, rowCount: res.affectedRows ?? res.rows.length };
    },
    async execMulti(sql: string): Promise<void> {
      await pglite.exec(sql);
    },
    async close(): Promise<void> {
      await pglite.close();
    },
  };
}

async function initDriver(): Promise<DbDriver> {
  const url = config.databaseUrl;
  const hasRealUrl =
    url.length > 0 &&
    !url.includes("YOUR_POSTGRES_PASSWORD") &&
    !url.startsWith("pglite://");

  if (hasRealUrl) {
    try {
      return await createPgPoolDriver(url);
    } catch (err: any) {
      if (!config.useEmbeddedPgFallback) {
        throw err;
      }
      console.warn(
        `[apps-db] Could not connect to DATABASE_URL (${err?.message || err}). Using standalone Apps PostgreSQL (PGlite) at ${PGDATA_DIR}`,
      );
    }
  } else {
    console.log(`[apps-db] Booting standalone Apps PostgreSQL at ${PGDATA_DIR}`);
  }

  return createEmbeddedDriver();
}

export async function getDb(): Promise<DbDriver> {
  if (activeDriver) return activeDriver;
  if (!initPromise) {
    initPromise = initDriver().then((d) => {
      activeDriver = d;
      return d;
    });
  }
  return initPromise;
}

export async function dbQuery<T = any>(sql: string, params: any[] = []): Promise<DbQueryResult<T>> {
  const db = await getDb();
  return db.query<T>(sql, params);
}

/**
 * Hot-switches the Apps Backend to a Cloud PostgreSQL URL (Neon / Supabase / Railway / Render),
 * runs full schema migration + seed on the Cloud DB, and persists DATABASE_URL to `.env`!
 */
export async function hotSwitchDatabaseUrl(
  newUrl: string,
  onReadyMigrateAndSeed: () => Promise<void>,
): Promise<{ mode: "pg" | "pglite"; cloudHost: string | null }> {
  const trimmed = String(newUrl || "").trim();
  const prevDriver = activeDriver;

  const nextDriver = trimmed ? await createPgPoolDriver(trimmed) : await createEmbeddedDriver();

  activeDriver = nextDriver;
  initPromise = Promise.resolve(nextDriver);
  config.databaseUrl = trimmed;

  try {
    await onReadyMigrateAndSeed();
  } catch (err) {
    activeDriver = prevDriver;
    initPromise = prevDriver ? Promise.resolve(prevDriver) : null;
    await nextDriver.close().catch(() => {});
    throw err;
  }

  if (prevDriver && prevDriver !== nextDriver) {
    await prevDriver.close().catch(() => {});
  }

  // Persist to .env so future restarts stay connected to Cloud PostgreSQL!
  try {
    let envText = fs.existsSync(ENV_FILE_PATH) ? fs.readFileSync(ENV_FILE_PATH, "utf8") : "";
    if (/^DATABASE_URL=.*$/m.test(envText)) {
      envText = envText.replace(/^DATABASE_URL=.*$/m, `DATABASE_URL=${trimmed}`);
    } else {
      envText += `\nDATABASE_URL=${trimmed}\n`;
    }
    fs.writeFileSync(ENV_FILE_PATH, envText, "utf8");
  } catch {}

  return { mode: nextDriver.mode, cloudHost: nextDriver.cloudHost ?? null };
}
