# Vitrio

SaaS de catálogo, reservas y encargos para comercios locales (bares, belleza, moda y servicios).
Cada comercio recibe un catálogo público con QR, agenda de reservas y encargos, y paga una
suscripción mensual o anual. **No hay auto-registro**: el superadmin da de alta los comercios.

- Demo pública: `/c/bar-la-plaza` (usuario `demo@vitrio.app` / `demo1234`)
- Panel de administración: `/admin` · Acceso: `/login` · Primera puesta en marcha: `/setup`
- **Despliegue a coste 0 (Netlify + Supabase): [NETLIFY.md](./NETLIFY.md)**
- Despliegue con Docker / VPS / Render / Railway: [DEPLOY.md](./DEPLOY.md)

---

## 1. Stack

| Pieza | Versión | Notas |
|---|---|---|
| Next.js | 16.4 (App Router, Server Actions) | `output: standalone` para Docker |
| React | 19.3 | `useActionState` en todos los formularios |
| TypeScript | 5/7 | `strict: true` |
| Tailwind CSS | 4 | Tokens en `@theme` |
| PostgreSQL | 17 (local) / Supabase | Requiere 13+ (`gen_random_uuid`) |
| Drizzle ORM | 0.45 | Migraciones SQL versionadas en `drizzle/` |
| Stripe | 23 | Checkout hosted, tarjeta + Bizum |
| Node | 20.9+ (probado en 20.20 y 22) | |

## 2. Arranque local

```bash
cp .env.example .env          # ajusta DATABASE_URL y ADMIN_*
npm install
npm run db:migrate            # aplica drizzle/*.sql
npm run seed                  # planes + superadmin + comercio demo
npm run dev                   # http://localhost:3000
```

Con Docker (app + PostgreSQL):

```bash
docker compose up -d --build  # http://localhost:3000/api/health
```

Variables de entorno: ver la tabla de [DEPLOY.md](./DEPLOY.md#2-variables-de-entorno).
Sin `STRIPE_SECRET_KEY` la app funciona: los cobros aparecen como «no configurados».

## 3. Roles y rutas

| Ruta | Quién | Qué hace |
|---|---|---|
| `/` | público | Landing con planes |
| `/setup` | solo si no hay usuarios | Crea el superadmin y los planes por defecto |
| `/login` | todos | Sesión con cookie `vitrio_session` |
| `/admin` | superadmin | Métricas, solicitudes de activación, pruebas que vencen |
| `/admin/comercios` · `/nuevo` · `/[id]` | superadmin | Altas, ficha, plan, trial, congelar, borrar, suplantar |
| `/admin/planes` | superadmin | Precios, límites y funciones por plan |
| `/app` | comercio | Resumen: agenda de hoy, encargos abiertos, puesta en marcha |
| `/app/catalogo` | comercio | Productos con foto, categoría, visibilidad |
| `/app/servicios` | comercio | Servicios reservables: duración, aforo, señal |
| `/app/reservas` | comercio | Agenda, filtros, alta manual, recordatorio por WhatsApp |
| `/app/encargos` | comercio | Pedidos con flujo de estados |
| `/app/qr` | comercio | QR descargable e imprimible |
| `/app/ajustes` | comercio | Perfil, horarios, aforo, prepago, módulos y cobros |
| `/app/plan` | comercio | Consumo del plan y solicitud de activación |
| `/congelada` | comercio congelado | Aviso con fecha de borrado y contacto |
| `/c/[slug]` | público | Catálogo con buscador y categorías |
| `/c/[slug]/reservar` | público | Reserva de mesa (bar) o cita (servicios) |
| `/c/[slug]/encargo` | público | Carrito con hora de recogida o entrega |
| `/r/[code]` · `/p/[code]` | público | Seguimiento por código + pago de la señal |
| `/q/[slug]` | público | Enlace del QR: cuenta el escaneo y redirige |
| `/legal` | público | Borrador de aviso legal y privacidad |

APIs: `/api/health`, `/api/cron/lifecycle`, `/api/stripe/webhook`, `/api/qr/[slug]`, `/api/img/[id]`.

## 4. Reglas de negocio implementadas

**Planes**: Básico 19 €, Pro 39 €, Premium 59 € al mes (sin IVA), con precio anual. Los define el
superadmin y limitan productos y reservas/mes. Funciones por plan: `catalog`, `qr`, `bookings`,
`orders`, `payments`, `whatsapp`, `stats`, `reviews` (próximamente).

**Trial**: 30 días sin tarjeta. Avisos por email a 3 y 1 días. Al vencer, la cuenta se congela
14 días (el catálogo deja de mostrarse y el panel redirige a `/congelada`) y después se borran
los datos operativos y se anonimiza la ficha. Todo lo ejecuta `runLifecycle()`, que corre por cron
(`/api/cron/lifecycle` con `CRON_SECRET`) y de forma perezosa en `getSession` y en el catálogo,
como máximo una vez por minuto.

**Reservas**: el aforo cuenta comensales en bares y citas simultáneas en servicios. Un
`pg_advisory_xact_lock` por comercio serializa la creación y evita dobles reservas. Una reserva
pendiente de pago retiene el hueco 35 minutos (tarjeta) o 2 horas (Bizum) y luego se cancela sola.
El horario semanal admite dos tramos por día y la disponibilidad se calcula en `Europe/Madrid`.

**Encargos**: los importes se recalculan siempre desde la base de datos (nunca se confía en el
carrito del cliente). Solo se pueden encargar productos visibles con precio.

**Pagos**: **Stripe Connect con cargo directo**. Vitrio tiene una cuenta de plataforma cuya
única función es crear sesiones de Checkout y recibir webhooks; cada comercio conecta su cuenta
Express desde `/app/ajustes` y **el dinero entra directamente en su cuenta**. Las comisiones de
Stripe las asume el comercio. Checkout hosted con tarjeta y Bizum (si su cuenta lo permite). El
webhook firmado (con eventos de cuentas conectadas) liquida el pago; la URL de retorno solo
sirve para *verificar* la sesión contra la API. La liquidación es idempotente y los pagos ya
cobrados no se cancelan desde la app: se reembolsan en Stripe.

Si el comercio no tiene Stripe conectado, las reservas se confirman **sin señal** y los
encargos se pagan en el local: la app nunca deja una reserva bloqueada esperando un pago que no
puede producirse.

**Cuota de Vitrio**: no hay cobro automático todavía. «Contratar» registra una solicitud
(`activation_requested`) y el superadmin activa el plan a mano. La intención es facturarla con
Stripe Billing (mensual o anual, +21 % IVA) en la cuenta de la plataforma, separada de los
cobros de los comercios.

## 5. Decisiones de arquitectura

- **Sin Supabase**: sesiones propias en PostgreSQL (`sessions` con hash SHA-256 del token), cookies
  `HttpOnly` + `SameSite=Lax` y contraseñas con `scrypt`. Cada consulta se filtra por el
  `tenant_id` de la sesión en servidor; no hay RLS porque no hay cliente directo a la base de datos.
- **Imágenes**: se reducen en el móvil y se guardan como data URL en PostgreSQL, servidas por
  `/api/img/[id]` con caché. A partir de cierto volumen conviene un bucket de objetos.
- **Rate limiting**: en memoria (una instancia). Los fallos de login se cuentan por email y solo
  los intentos fallidos, para no bloquear a un usuario legítimo.
- **Auditoría ligera**: tabla `events` (`login`, `qr_scan`, `booking_created`, `payment_paid`,
  `trial_frozen`, `impersonation`…). Alimenta las métricas del admin.
- **PWA**: manifiesto, iconos y un service worker mínimo que solo muestra `/offline`.

## 6. Pruebas

La batería de extremo a extremo está en `tests/e2e.mjs` (Playwright, fuera de las dependencias
del proyecto para no engordar la imagen):

```bash
mkdir -p ~/pw && cd ~/pw
npm init -y && npm i playwright && npx playwright install --with-deps chromium
BASE_URL=http://localhost:3000 node /ruta/al/proyecto/tests/e2e.mjs
```

Cubre 25 comprobaciones: login de superadmin, alta de comercio con credenciales, reserva pública
con señal, aforo, encargo público, agenda y pedidos del comercio, QR, cambio obligatorio de
contraseña, congelación (catálogo 404 + pantalla de aviso), healthcheck y cron.
Última ejecución: **25/25** (19/11/2026) con PostgreSQL 17 local y conexión TLS tipo Supabase.

## 7. Limitaciones conocidas

1. **Stripe Connect sin probar contra la API real.** En este entorno no hay claves de Stripe: se
   ha verificado todo el comportamiento sin configurar (reservas sin señal, avisos en el panel)
   y la lógica de Connect, pero el alta de un comercio y un cobro real hay que probarlos en modo
   test con `STRIPE_SECRET_KEY` de test. Ver NETLIFY.md §5.
2. **Sin cobro de suscripciones**: falta Stripe Billing (trial, dunning, facturas).
3. **Bizum** depende de que la cuenta de Stripe **del comercio** lo tenga habilitado (EUR,
   0,50–5.000 €). El Bizum automático vía Redsys no está implementado.
4. **Emails**: sin `RESEND_API_KEY` los avisos solo se escriben en el log.
5. **Rate limiting en PostgreSQL**: funciona entre instancias, pero añade una consulta por
   intento. Con mucho tráfico habría que moverlo a Redis.
6. **Imágenes en la base de datos**: revisar antes de crecer.
7. **Supabase free** pausa el proyecto tras 7 días sin actividad y da 500 MB. El cron diario lo
   mantiene despierto; las fotos en la base de datos son el primer consumo a vigilar.
8. **Netlify + Next 16**: verificado el build con la configuración de Netlify, pero el plugin
   oficial no se ha podido ejecutar aquí. Plan B documentado (fijar Next 15 o desplegar en
   Vercel/Railway/Render).
9. **Textos legales**: `/legal` es un borrador con `[...]` pendientes de completar y revisar.
10. **Reseñas de Google**: marcadas como «próximamente».
11. **Sin tests unitarios** ni CI: solo la batería de Playwright descrita arriba.

## 8. Estructura

```
src/
  app/
    admin/            superadmin (métricas, comercios, planes, cuenta)
    app/              panel del comercio (+ actions.ts y forms.tsx)
    c/[slug]/         catálogo público, reserva, encargo (+ actions.ts)
    r/[code] p/[code] seguimiento público de reservas y encargos
    q/[slug]/         redirección del QR con conteo
    api/              health, cron, webhook de Stripe, QR, imágenes
    actions/auth.ts   login, logout, setup, cambio de contraseña
  components/         UI compartida y formularios de cliente
  db/                 schema.ts, migrate.ts, seed.ts
  lib/                auth, booking, lifecycle, stripe, plans, time, money,
                      ratelimit, email, public, password, bootstrap
drizzle/              migraciones SQL generadas
scripts/migrate.mjs   migraciones en producción (imagen Docker)
tests/e2e.mjs         batería Playwright
```

Comandos útiles:

| Comando | Para qué |
|---|---|
| `npm run dev` / `build` / `typecheck` | desarrollo y validación |
| `npm run db:check` | comprueba la conexión (host, TLS, tablas, migraciones) sin escribir nada |
| `npm run db:migrate` | aplica migraciones (`drizzle/`) |
| `npm run db:generate` | genera migración tras cambiar `schema.ts` |
| `npm run seed` | planes + superadmin + comercio demo |
| `npm run db:demo` | solo el comercio demo (para usar después de crear el superadmin en `/setup`) |

`SEED_ADMIN=false` y `SEED_DEMO=false` permiten sembrar partes sueltas.

## 9. Despliegue a coste 0

Netlify (hosting + funciones) y Supabase (PostgreSQL) cubren todo el proyecto en sus planes
gratuitos. Instrucciones completas en **[NETLIFY.md](./NETLIFY.md)**. Lo específico de esa
combinación:

- `netlify.toml` + plugin oficial de Next.js; `output: standalone` se omite automáticamente
  cuando `NETLIFY=true` (se reserva para la imagen Docker).
- Conexión a Supabase por el **pooler** (puerto 6543) con `sslmode=require`; `src/lib/pgconfig.ts`
  traduce el `sslmode` a TLS válido y admite CA propia (`PGSSL_CA`) o `sslmode=verify-full`.
- Rate limiting en PostgreSQL (`rate_limits`), porque en serverless la memoria no se comparte.
- Los scripts (`db:migrate`, `seed`, `db:check`) comparten la misma traducción de TLS que la app
  (`src/lib/pgconfig.ts`): sin eso fallaban contra Supabase con `SELF_SIGNED_CERT_IN_CHAIN`.
- Cron diario con una función programada de Netlify (`netlify/functions/lifecycle.mjs`), que
  además mantiene el proyecto de Supabase despierto.
- Stripe Connect con cargo directo: cada comercio cobra en su cuenta y asume sus comisiones.
