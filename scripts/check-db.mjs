/**
 * Comprueba la conexion a PostgreSQL sin arrancar la app.
 * Uso:  npm run db:check
 *
 * Sirve para validar la cadena de Supabase (pooler, TLS, contraseña, IPv4)
 * antes de desplegar. No escribe nada.
 */
import fs from "node:fs";
import pg from "pg";

// Carga .env si existe (en un clon nuevo puede no estar: no debe romper)
try {
  process.loadEnvFile(".env");
} catch {
  /* sin .env: se usan las variables del entorno */
}

const raw = process.env.DATABASE_URL;
if (!raw) {
  console.error("✗ Falta DATABASE_URL");
  process.exit(1);
}

function connectionOptions(url) {
  const parsed = new URL(url);
  const mode = parsed.searchParams.get("sslmode") ?? (process.env.PGSSL === "true" ? "require" : "disable");
  parsed.searchParams.delete("sslmode");
  const connectionString = parsed.toString();
  if (mode === "disable") return { connectionString, ssl: undefined, mode };
  const ca = process.env.PGSSL_CA ? fs.readFileSync(process.env.PGSSL_CA, "utf8") : undefined;
  const verify = Boolean(ca) || mode.startsWith("verify") || process.env.PGSSL_VERIFY === "true";
  return { connectionString, ssl: { rejectUnauthorized: verify, ca }, mode };
}

const opts = connectionOptions(raw);
const pretty = new URL(raw);

console.log("Destino:");
console.log(`  host      ${pretty.hostname}`);
console.log(`  puerto    ${pretty.port || "(por defecto 5432)"}`);
console.log(`  usuario   ${decodeURIComponent(pretty.username)}`);
console.log(`  base      ${pretty.pathname.replace("/", "")}`);
console.log(`  TLS       ${opts.mode}`);

if (pretty.hostname.startsWith("db.")) {
  console.log("\n⚠ Esta es la conexion DIRECTA. Los proyectos nuevos solo la exponen por IPv6");
  console.log("  y Netlify no siempre tiene IPv6. Para Netlify usa el Transaction pooler (6543).");
}
if (!pretty.port) {
  console.log("\n⚠ Sin puerto explicito: se usara 5432 (directa o session pooler).");
}

const start = Date.now();
const client = new pg.Client({ ...opts, connectionTimeoutMillis: 12000 });

try {
  await client.connect();
  const info = await client.query("select version(), current_database() as db, current_user as usr");
  const ssl = await client.query("select ssl from pg_stat_ssl where pid = pg_backend_pid()");
  const tables = await client.query(
    "select count(*)::int as n from information_schema.tables where table_schema = 'public'",
  );
  const migrations = await client
    .query("select count(*)::int as n from drizzle.__drizzle_migrations")
    .catch(() => ({ rows: [{ n: "sin tabla de migraciones" }] }));

  console.log(`\n✓ Conexion correcta en ${Date.now() - start} ms`);
  console.log(`  ${info.rows[0].version.split(",")[0]}`);
  console.log(`  base: ${info.rows[0].db} · usuario: ${info.rows[0].usr}`);
  const isPooler = pretty.hostname.includes("pooler.");
  console.log(
    isPooler
      ? "  TLS cliente→pooler: si (pg_stat_ssl mide el tramo interno del pooler, por eso puede salir 'no')"
      : `  TLS activo: ${ssl.rows[0]?.ssl ? "si" : "no"}`,
  );
  console.log(`  tablas en public: ${tables.rows[0].n}`);
  console.log(`  migraciones aplicadas: ${migrations.rows[0].n}`);

  if (tables.rows[0].n === 0) {
    console.log("\n→ La base esta vacia: ejecuta `npm run db:migrate`.");
  } else if (tables.rows[0].n < 11) {
    console.log("\n→ Faltan tablas: ejecuta `npm run db:migrate`.");
  } else {
    console.log("\n→ Todo listo: la app puede usar esta cadena como DATABASE_URL.");
  }
} catch (err) {
  console.error(`\n✗ No se pudo conectar (${Date.now() - start} ms): ${err.message}`);
  console.error("\nPistas:");
  const msg = String(err.message);
  if (/password authentication failed|Tenant or user not found/i.test(msg)) {
    console.error("  · Usuario o contraseña incorrectos. En el pooler el usuario debe ser postgres.[PROJECT-REF].");
    console.error("    Si la contraseña tiene caracteres especiales, codifícala: @ → %40, # → %23, ? → %3F");
  } else if (/self-signed certificate|certificate/i.test(msg)) {
    console.error("  · Problema de certificado: añade ?sslmode=require a la URL (o PGSSL_CA con la CA de Supabase).");
  } else if (/ENETUNREACH|EHOSTUNREACH|ENOTFOUND|EAI_AGAIN/i.test(msg)) {
    console.error("  · No hay ruta de red: probablemente IPv6. Usa el pooler (host *.pooler.supabase.com).");
  } else if (/timeout|ETIMEDOUT/i.test(msg)) {
    console.error("  · Sin respuesta: revisa que el proyecto Supabase no este pausado.");
  } else if (/too many clients|max client connections/i.test(msg)) {
    console.error("  · Limite de conexiones: usa el Transaction pooler y PG_POOL_MAX bajo (3).");
  }
  process.exitCode = 1;
} finally {
  await client.end().catch(() => undefined);
}
