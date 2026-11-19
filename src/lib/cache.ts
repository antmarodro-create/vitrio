/**
 * Micro-caché en memoria del proceso (por instancia de función).
 *
 * En Netlify cada instancia atiende varias peticiones antes de apagarse: guardar
 * aquí la ficha de un comercio durante unos segundos evita repetir el viaje a
 * la base de datos, que es lo caro. No es una caché distribuida: si hay 5
 * instancias, cada una guarda su copia. Para el catálogo público es suficiente.
 */
type Entry = { value: unknown; expiresAt: number };

const store = new Map<string, Entry>();
const MAX_ENTRIES = 200;

export async function memo<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.expiresAt > now) return hit.value as T;

  const value = await load();

  if (store.size >= MAX_ENTRIES) {
    for (const [k, entry] of store) if (entry.expiresAt <= now) store.delete(k);
    if (store.size >= MAX_ENTRIES) store.clear();
  }
  store.set(key, { value, expiresAt: now + ttlMs });
  return value;
}

/** Solo para pruebas: vacía la caché del proceso. */
export function clearMemo(): void {
  store.clear();
}
