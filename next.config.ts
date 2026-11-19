import type { NextConfig } from "next";

// En Netlify (funciones serverless) el plugin oficial gestiona el empaquetado:
// "standalone" solo se usa para la imagen Docker.
const isNetlify = Boolean(process.env.NETLIFY) || process.env.DEPLOY_TARGET === "netlify";

/** Host(s) de la app segun el entorno, para permitir sus server actions. */
function appHosts(): string[] {
  const hosts: string[] = [];
  for (const value of [process.env.NEXT_PUBLIC_APP_URL, process.env.URL, process.env.DEPLOY_PRIME_URL]) {
    if (!value) continue;
    try {
      hosts.push(new URL(value).host);
    } catch {
      /* valor no valido: se ignora */
    }
  }
  return hosts;
}

const nextConfig: NextConfig = {
  ...(isNetlify ? {} : { output: "standalone" as const }),
  poweredByHeader: false,
  // Se dejan fuera del bundle para que existan en node_modules del contenedor
  // (scripts/migrate.mjs los necesita al arrancar).
  serverExternalPackages: ["pg", "drizzle-orm"],
  experimental: {
    serverActions: {
      // El navegador envia el Origin real; si no esta en la lista, Next rechaza la accion
      // SIN avisar y el formulario "no hace nada" (login incluido). Por eso se anaden el
      // host de NEXT_PUBLIC_APP_URL, los de Netlify y los locales de desarrollo.
      allowedOrigins: [
        "*.e2b.app",
        "*.e2b.dev",
        "*.netlify.app",
        ...appHosts(),
        "localhost:3000",
        "localhost:3001",
        "127.0.0.1:3000",
        "127.0.0.1:3001",
      ],
      // Fotos de producto (se guardan como data URL en la base de datos)
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
