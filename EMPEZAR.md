# Empezar de cero

Todo lo necesario para levantar Vitrio desde un ZIP recién descomprimido, con o sin base de
datos, en tu ordenador o en Netlify.

## En tu ordenador (5 minutos)

Requisitos: **Node 20 o superior** (probado en 20 y 22) y **PostgreSQL 14+** (o la cadena de
Supabase, ver más abajo).

```bash
cd vitrio
npm install

cp .env.example .env
# edita .env: al menos DATABASE_URL y NEXT_PUBLIC_APP_URL
```

`.env` mínimo:

```
DATABASE_URL=postgresql://postgres:password@127.0.0.1:5432/vitrio
NEXT_PUBLIC_APP_URL=http://localhost:3000
BUSINESS_TIME_ZONE=Europe/Madrid
CRON_SECRET=cualquier-cosa-larga
```

Después:

```bash
npm run db:migrate       # crea las 11 tablas (4 migraciones)
npm run seed             # planes + superadmin + comercio de ejemplo
npm run demo:showroom    # los 3 comercios de prueba, uno por plan
npm run dev              # http://localhost:3000
```

Entra en `/setup` si no sembraste el superadmin, o usa el del seed:
`admin@vitrio.app` / la contraseña que hayas puesto en `ADMIN_PASSWORD`.

> Los scripts cargan `.env` si existe y **funcionan igual sin él** (usando las variables del
> entorno). Si algo dice «DATABASE_URL no está definida», es que falta la variable, no el
> fichero.

## Comprobar que está todo bien

```bash
npm run db:check        # conexión, TLS, tablas y migraciones
npm run typecheck       # TypeScript
npm run build           # compila sin necesitar base de datos
npm run smoke -- http://localhost:3000
```

## En Netlify

Repo → *Add new site → Import an existing project → GitHub* y variables de entorno. Está
detallado en `NETLIFY.md`; lo imprescindible:

```
DATABASE_URL            cadena del pooler de Supabase (puerto 6543, ?sslmode=require)
NEXT_PUBLIC_APP_URL     https://TU-SITIO.netlify.app
CRON_SECRET             openssl rand -hex 24
BUSINESS_TIME_ZONE      Europe/Madrid
PG_POOL_MAX             3
```

Y dos ajustes que se olvidan y explican casi todos los «no carga»:

1. ***Build & deploy → Functions region* = `eu-central-1`** (Fráncfort): si las funciones corren
   en EE. UU. y la base está en Europa, cada consulta cruza el Atlántico.
2. **Redesplegar** después de tocar variables: las funciones las leen solo al desplegar.

Después del primer deploy, carga los datos del showroom contra Supabase:

```bash
DATABASE_URL="postgresql://postgres.<ref>:clave@aws-N-<region>.pooler.supabase.com:6543/postgres?sslmode=require" \
  npm run demo:showroom
```

## Subirlo a GitHub desde este ZIP

El ZIP incluye la carpeta `.git` con el historial. Tres caminos:

**Con GitHub Desktop**: *File → Add local repository* → carpeta `vitrio` → **Publish repository**.

**Con terminal**, tras crear el repositorio vacío en github.com/new:

```bash
cd vitrio
git remote add origin https://github.com/TU-USUARIO/vitrio.git
git push -u origin main
```

**Sin git**: arrastra el contenido de `vitrio` a *Add file → Upload files* (máximo 100 ficheros
por tanda y se pierde el historial).

## Qué hay dentro

| Carpeta / fichero | Contenido |
|---|---|
| `src/app` | Rutas: `/`, `/login`, `/setup`, `/admin`, `/app`, `/c/[slug]`, `/r/[code]`, `/p/[code]`, `/q/[slug]` |
| `src/lib` | Sesiones, reservas, Stripe Connect, ciclo de vida, rate limit, conexión a Postgres |
| `src/db` | Esquema Drizzle, migrador, seed y showroom |
| `drizzle/` | 4 migraciones SQL + journal (necesario para migrar) |
| `public/demo/` | Fotos de los comercios de prueba |
| `netlify.toml`, `netlify/functions/lifecycle.mjs` | Despliegue y cron diario |
| `NETLIFY.md` | Despliegue paso a paso, cadena de Supabase y errores típicos |
| `STRIPE.md` | Cobros en modo test: Connect, webhook, tarjeta 4242, reembolsos |
| `SHOWROOM.md` | Los tres comercios de prueba y el circuito de confirmación |
| `LEEME.md` | Visión funcional, comandos y decisiones de producto |
| `DEPLOY.md` | Alternativa con Docker / Render / Railway |
| `tests/` | Batería E2E (25 comprobaciones) y prueba del circuito de bandeja |
