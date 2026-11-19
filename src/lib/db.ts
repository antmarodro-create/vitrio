import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@/db/schema";
import { pgConnection } from "./pgconfig";

/**
 * Pool y cliente de Drizzle creados de forma PEREZOSA: hasta la primera consulta
 * no se lee DATABASE_URL ni se abre ninguna conexión. Así los scripts pueden
 * cargar `.env` después de importar este módulo (importar no ejecuta nada).
 */
const globalForDb = globalThis as unknown as {
  __vitrioPool?: Pool;
  __vitrioDb?: NodePgDatabase<typeof schema>;
};

function createPool(): Pool {
  const connection = pgConnection(process.env.DATABASE_URL);
  return new Pool({
    connectionString: connection.connectionString,
    ssl: connection.ssl,
    // En serverless (Netlify) cada instancia mantiene su propio pool: conviene
    // un máximo bajo y la cadena "pooled" del proveedor (Supabase/Neon).
    max: Number(process.env.PG_POOL_MAX ?? (process.env.NETLIFY ? 3 : 10)),
    // Mantener la conexión viva evita repetir el TLS hasta la base de datos en
    // cada arranque en frío de la función.
    keepAlive: true,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
}

export function getPool(): Pool {
  if (!globalForDb.__vitrioPool) globalForDb.__vitrioPool = createPool();
  return globalForDb.__vitrioPool;
}

export function getDb(): NodePgDatabase<typeof schema> {
  if (!globalForDb.__vitrioDb) globalForDb.__vitrioDb = drizzle(getPool(), { schema });
  return globalForDb.__vitrioDb;
}

/**
 * `db` mantiene la API de antes (`db.select()...`) pero se construye al primer uso,
 * no al importar el módulo.
 */
export const db = new Proxy({} as NodePgDatabase<typeof schema>, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
  has(_target, prop) {
    return prop in getDb();
  },
});

export const pool = new Proxy({} as Pool, {
  get(_target, prop, receiver) {
    const real = getPool();
    const value = Reflect.get(real, prop, receiver);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export { schema };
