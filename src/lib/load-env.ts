/**
 * Carga `.env` si existe. Sin esto, `npm run db:migrate` en un clon recién
 * descargado muere con "node: .env: not found": el archivo no se sube al repo.
 */
export function loadEnv(): void {
  for (const file of [".env.local", ".env"]) {
    try {
      process.loadEnvFile(file);
      return;
    } catch {
      /* no existe: seguimos con el entorno tal cual */
    }
  }
}
