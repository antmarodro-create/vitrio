import type { NextConfig } from "next";

// En Netlify (funciones serverless) el plugin oficial gestiona el empaquetado:
// "standalone" solo se usa para la imagen Docker.
const isNetlify = Boolean(process.env.NETLIFY) || process.env.DEPLOY_TARGET === "netlify";

const nextConfig: NextConfig = {
  ...(isNetlify ? {} : { output: "standalone" as const }),
  poweredByHeader: false,
  // Se dejan fuera del bundle para que existan en node_modules del contenedor
  // (scripts/migrate.mjs los necesita al arrancar).
  serverExternalPackages: ["pg", "drizzle-orm"],
  experimental: {
    serverActions: {
      // Detrás de proxies de preview el Origin no coincide con el host interno.
      allowedOrigins: ["*.e2b.app", "*.e2b.dev", "*.netlify.app", "localhost:3000"],
      // Fotos de producto (se guardan como data URL en la base de datos)
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
