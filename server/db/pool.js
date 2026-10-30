import pg from "pg";

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL;
const isVercelRuntime = process.env.VERCEL === "1";

export const isDatabaseConfigured = Boolean(databaseUrl);

const shouldUseSsl = databaseUrl?.includes("supabase") || process.env.DATABASE_SSL === "true";

export const pool = new Pool({
  connectionString: databaseUrl,
  // Supabase transaction pooler + serverless functions should keep the
  // per-instance pool small to avoid exhausting database connections.
  max: Number(process.env.DATABASE_POOL_MAX || (isVercelRuntime ? 1 : 5)),
  idleTimeoutMillis: Number(process.env.DATABASE_IDLE_TIMEOUT_MS || (isVercelRuntime ? 10_000 : 30_000)),
  connectionTimeoutMillis: 5_000,
  keepAlive: true,
  ...(shouldUseSsl ? { ssl: { rejectUnauthorized: false } } : {}),
});

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL pool error", error.message);
});

export async function closePool() {
  await pool.end();
}
