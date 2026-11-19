/**
 * Configuracion de conexion a PostgreSQL valida para local, Docker y Supabase.
 *
 * Supabase exige TLS. Con `sslmode=require` node-postgres intenta verificar el
 * certificado, y en las conexiones directas de Supabase la CA no esta en el
 * almacen del sistema, asi que falla con "self-signed certificate". Aqui se
 * traduce el sslmode a una configuracion explicita:
 *
 *   sslmode=disable                 -> sin TLS
 *   sslmode=require (por defecto)   -> TLS cifrado sin verificar la CA
 *   sslmode=verify-full             -> TLS verificado (necesita CA publica)
 *   PGSSL_VERIFY=true               -> fuerza verificacion
 *   PGSSL_CA=/ruta/supabase-ca.crt  -> verifica contra esa CA
 */
import fs from "node:fs";

export type PgConnection = { connectionString: string; ssl?: { rejectUnauthorized: boolean; ca?: string } };

export function pgConnection(rawUrl: string | undefined): PgConnection {
  if (!rawUrl) return { connectionString: "" };

  let mode = "require";
  let stripped = rawUrl;
  try {
    const url = new URL(rawUrl);
    mode = url.searchParams.get("sslmode") ?? (process.env.PGSSL === "true" ? "require" : "disable");
    url.searchParams.delete("sslmode");
    stripped = url.toString();
  } catch {
    // Cadena no estandar: se usa tal cual y decide node-postgres
    return { connectionString: rawUrl };
  }

  if (mode === "disable") return { connectionString: stripped };

  const caPath = process.env.PGSSL_CA;
  if (caPath) {
    const ca = fs.readFileSync(caPath, "utf8");
    return { connectionString: stripped, ssl: { rejectUnauthorized: true, ca } };
  }

  const verify = mode === "verify-full" || mode === "verify-ca" || process.env.PGSSL_VERIFY === "true";
  return { connectionString: stripped, ssl: { rejectUnauthorized: verify } };
}
