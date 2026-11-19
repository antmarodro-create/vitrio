/**
 * Aplica las migraciones pendientes en produccion.
 *
 * Replica la logica del migrador oficial de Drizzle usando solo `pg` (que si
 * forma parte del bundle standalone), porque la imagen Docker no incluye las
 * herramientas de desarrollo (drizzle-kit / drizzle-orm como dependencia
 * resoluble). La tabla y el calculo del hash son identicos a los de
 * `npm run db:migrate`, asi que ambos caminos son intercambiables y no
 * duplican migraciones.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const FOLDER = process.env.MIGRATIONS_FOLDER ?? "./drizzle";
const SCHEMA = "drizzle";
const TABLE = "__drizzle_migrations";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("[migrate] DATABASE_URL no esta definida");
  process.exit(1);
}

function readMigrations() {
  const journalPath = path.join(FOLDER, "meta", "_journal.json");
  if (!fs.existsSync(journalPath)) {
    throw new Error(`No existe ${journalPath}`);
  }
  const journal = JSON.parse(fs.readFileSync(journalPath, "utf8"));
  return journal.entries.map((entry) => {
    const file = path.join(FOLDER, `${entry.tag}.sql`);
    const contents = fs.readFileSync(file, "utf8");
    return {
      tag: entry.tag,
      when: entry.when,
      statements: contents.split("--> statement-breakpoint").map((s) => s.trim()).filter(Boolean),
      hash: crypto.createHash("sha256").update(contents).digest("hex"),
    };
  });
}

/**
 * Misma traduccion de sslmode que src/lib/pgconfig.ts (Supabase exige TLS y su
 * CA directa no esta en el almacen del sistema).
 */
function connectionOptions(rawUrl) {
  const parsed = new URL(rawUrl);
  const mode = parsed.searchParams.get("sslmode") ?? (process.env.PGSSL === "true" ? "require" : "disable");
  parsed.searchParams.delete("sslmode");
  const connectionString = parsed.toString();
  if (mode === "disable") return { connectionString };
  const verify = mode.startsWith("verify") || process.env.PGSSL_VERIFY === "true";
  const ca = process.env.PGSSL_CA ? fs.readFileSync(process.env.PGSSL_CA, "utf8") : undefined;
  return { connectionString, ssl: { rejectUnauthorized: Boolean(ca) || verify, ca } };
}

const client = new pg.Client(connectionOptions(url));

try {
  await client.connect();
  await client.query(`CREATE SCHEMA IF NOT EXISTS ${SCHEMA}`);
  await client.query(
    `CREATE TABLE IF NOT EXISTS ${SCHEMA}.${TABLE} (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)`,
  );

  const { rows } = await client.query(`select created_at from ${SCHEMA}.${TABLE} order by created_at desc limit 1`);
  const lastApplied = rows[0] ? Number(rows[0].created_at) : 0;

  const pending = readMigrations().filter((m) => m.when > lastApplied);
  if (pending.length === 0) {
    console.log("[migrate] sin migraciones pendientes");
  }

  for (const migration of pending) {
    await client.query("BEGIN");
    try {
      for (const statement of migration.statements) {
        await client.query(statement);
      }
      await client.query(`insert into ${SCHEMA}.${TABLE} ("hash", "created_at") values ($1, $2)`, [
        migration.hash,
        migration.when,
      ]);
      await client.query("COMMIT");
      console.log(`[migrate] aplicada ${migration.tag}`);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }
  }
} catch (err) {
  console.error("[migrate] error", err);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => undefined);
}
