import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@/db/schema";
import { pgConnection } from "./pgconfig";

const globalForDb = globalThis as unknown as { __vitrioPool?: Pool };

const connection = pgConnection(process.env.DATABASE_URL);

export const pool =
  globalForDb.__vitrioPool ??
  new Pool({
    connectionString: connection.connectionString,
    ssl: connection.ssl,
    // En serverless (Netlify) cada instancia mantiene su propio pool: conviene
    // un maximo bajo y usar la cadena "pooled" del proveedor (Neon/Supabase).
    max: Number(process.env.PG_POOL_MAX ?? (process.env.NETLIFY ? 3 : 10)),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });

if (process.env.NODE_ENV !== "production") globalForDb.__vitrioPool = pool;

export const db = drizzle(pool, { schema });
export { schema };
