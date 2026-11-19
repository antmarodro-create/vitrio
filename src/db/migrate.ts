import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { pgConnection } from "@/lib/pgconfig";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL no esta definida");
  const connection = pgConnection(url);
  const pool = new Pool({ connectionString: connection.connectionString, ssl: connection.ssl, max: 1 });
  const db = drizzle(pool);
  await migrate(db, { migrationsFolder: "./drizzle" });
  await pool.end();
  console.log("Migraciones aplicadas");
}

main().catch((err) => {
  console.error("Error aplicando migraciones:", err);
  process.exit(1);
});
