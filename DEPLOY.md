# Desplegar Vitrio en producción (Docker / VPS / Render / Railway)

> **Si buscas coste 0 para pruebas, ve a [NETLIFY.md](./NETLIFY.md)**: Netlify + Supabase.
> Este documento sirve para cuando quieras servidor propio o contenedores.

Objetivo: tener la app en una URL estable, con PostgreSQL gestionado, dominio propio,
cron diario y Stripe apuntando al dominio real. Sin wildcards ni subdominios: cada
comercio vive en `https://tudominio.com/c/<slug>`, así que **no hace falta DNS wildcard**.

---

## 1. Lo que necesitas antes de empezar

| Cosa | Para qué | Coste orientativo |
|---|---|---|
| Cuenta en Render **o** Railway **o** un VPS | Ejecutar Node + Docker | 7–25 €/mes |
| PostgreSQL 17 gestionado | Base de datos | Incluido en Render/Railway, o **Supabase/Neon gratis** |
| Dominio | Enlaces estables | 10–15 €/año |
| Cuenta Stripe (opcional) | Cobros de señales y encargos | 1,5 % + 0,25 € por operación |

Todo el despliegue está preparado con **Docker**: `Dockerfile` multi-stage, `output: standalone`,
healthcheck en `/api/health` y migraciones automáticas al arrancar (`scripts/migrate.mjs`).

---

> `DATABASE_URL` puede apuntar igualmente al **pooler de Supabase** (puerto 6543 con
> `?sslmode=require`): el contenedor funciona igual. Ver NETLIFY.md §1 y §2.

## 2. Variables de entorno

Obligatorias:

| Variable | Ejemplo | Notas |
|---|---|---|
| `DATABASE_URL` | `postgresql://user:pass@host:5432/vitrio` | Usa `?sslmode=require` si el proveedor lo pide |
| `NEXT_PUBLIC_APP_URL` | `https://vitrio.es` | Sin barra final. **Se inlinea en el build**: pásala como build-arg |
| `ADMIN_EMAIL` | `antmarodro@gmail.com` | Superadmin inicial (o usa `/setup`) |
| `ADMIN_PASSWORD` | contraseña larga | Solo se usa al sembrar; luego cámbiala en la app |
| `CRON_SECRET` | cadena aleatoria | Protege `/api/cron/lifecycle` |

Recomendadas:

| Variable | Ejemplo | Notas |
|---|---|---|
| `BUSINESS_TIME_ZONE` | `Europe/Madrid` | Zona de referencia por defecto |
| `SEED_DEMO` | `false` | En producción déjalo en `false` |
| `EMAIL_FROM` | `Vitrio <no-reply@tudominio.com>` | Remitente verificado en Resend |

Opcionales (activan funciones):

| Variable | Activa |
|---|---|
| `STRIPE_SECRET_KEY` | Cobros con tarjeta/Bizum (Checkout) |
| `STRIPE_WEBHOOK_SECRET` | Confirmación fiable de pagos |
| `RESEND_API_KEY` | Emails reales (avisos de trial, congelación, borrado) |

Sin Stripe la app funciona igual: las reservas sin prepago y los encargos sin pago
online siguen operativos y los cobros aparecen como «no configurados».

---

## 3. Opción A — Render (la más rápida)

1. Sube el proyecto a un repositorio de GitHub (el `Dockerfile` ya está en la raíz).
2. En Render: **New → Blueprint**, elige el repo. Se lee `render.yaml` y crea:
   - un servicio web Docker `vitrio`,
   - una base PostgreSQL 17 `vitrio-db`,
   - un cron `vitrio-lifecycle` a las 04:00 UTC.
3. Rellena los secretos que piden (`sync: false`): `NEXT_PUBLIC_APP_URL`,
   `ADMIN_EMAIL`, `ADMIN_PASSWORD`, y si los tienes, las claves de Stripe y Resend.
4. Cuando el primer deploy termine, abre `https://<servicio>.onrender.com/api/health`
   → debe devolver `{"ok":true,"db":"up"}`.
5. Entra en `/setup`, crea la cuenta de administración (los planes por defecto se crean solos).
6. Dominio: **Settings → Custom Domain**, añade `vitrio.es` y el `www`, y apunta el DNS.
   Cambia `NEXT_PUBLIC_APP_URL` al dominio final y **vuelve a desplegar** (es una variable
   de build).

## 4. Opción B — Railway

1. **New Project → Deploy from GitHub repo**. Railway detecta `railway.json` y usa el Dockerfile.
2. Añade el plugin **PostgreSQL**: copia su `DATABASE_URL` a las variables del servicio.
3. Configura las variables del punto 2. `NEXT_PUBLIC_APP_URL` primero con la URL temporal.
4. Healthcheck ya configurado en `/api/health`. Las migraciones corren en el arranque.
5. Cron: **New → Cron Job** en el mismo proyecto, comando:
   ```sh
   curl -fsS -H "x-cron-secret: $CRON_SECRET" "$APP_URL/api/cron/lifecycle"
   ```
   con `schedule = 0 4 * * *`.
6. Dominio en **Settings → Networking → Custom Domain** y actualiza `NEXT_PUBLIC_APP_URL`.

## 5. Opción C — VPS propio (Docker + Caddy)

```bash
git clone <tu-repo> vitrio && cd vitrio
cp .env.example .env    # edita DATABASE_URL, NEXT_PUBLIC_APP_URL, ADMIN_*, CRON_SECRET
docker compose up -d --build
curl localhost:3000/api/health
```

TLS y proxy con Caddy (`/etc/caddy/Caddyfile`):

```
vitrio.es {
    encode gzip
    reverse_proxy 127.0.0.1:3000
}
```

Cron del sistema (`crontab -e`):

```
0 4 * * * curl -fsS -H "x-cron-secret: TU_SECRETO" https://vitrio.es/api/cron/lifecycle > /dev/null
```

Copias de seguridad diarias:

```
15 3 * * * docker exec vitrio-db-1 pg_dump -U vitrio vitrio | gzip > /backups/vitrio-$(date +\%F).sql.gz
```

---

## 6. Stripe en producción

1. Activa la cuenta de Stripe (titular autónomo o sociedad) y completa la verificación.
2. **Developers → API keys**: copia la clave secreta `sk_live_...` en `STRIPE_SECRET_KEY`.
3. **Developers → Webhooks → Add endpoint**:
   - URL: `https://tudominio.com/api/stripe/webhook`
   - Eventos: `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
     `checkout.session.async_payment_failed`, `checkout.session.expired`
   - Copia el signing secret (`whsec_...`) en `STRIPE_WEBHOOK_SECRET`.
4. **Settings → Payment methods**: activa tarjeta y, si tu cuenta lo permite, **Bizum**
   (solo EUR y operaciones entre 0,50 € y 5.000 €).
5. Prueba en modo test con la tarjeta `4242 4242 4242 4242` y con Bizum test; después
   repite con claves live.
6. Los reembolsos se hacen desde el panel de Stripe. La app bloquea cancelar un registro
   pagado para no descuadrar la contabilidad.

---

## 7. Checklist de salida a producción

- [ ] `/api/health` devuelve `ok: true` en el dominio final
- [ ] `/setup` completado y contraseña del superadmin guardada en un gestor
- [ ] `NEXT_PUBLIC_APP_URL` apunta al dominio real y se ha redesplegado
- [ ] Alta de un comercio de prueba y reserva completa desde el móvil
- [ ] Webhook de Stripe en verde (evento de prueba enviado desde el panel)
- [ ] Cron ejecutado a mano: `curl -H "x-cron-secret: ..." .../api/cron/lifecycle`
- [ ] Emails reales comprobados (o asumido que van al log)
- [ ] Textos legales completados (sustituir los `[...]` de `/legal`)
- [ ] Copia de la base de datos programada y **probada restaurando**
- [ ] Registro de actividades de tratamiento y revisión legal

---

## 8. Después del despliegue: límites conocidos

- El rate limiting es en memoria: con **más de una instancia** hay que moverlo a Redis/Postgres.
- Las imágenes se guardan como data URL en PostgreSQL. A partir de unos cientos de comercios,
  muévelas a un bucket (S3/R2/Supabase Storage).
- No hay cobro automático de las suscripciones de Vitrio: «contratar» registra una solicitud
  y el plan se activa a mano. El siguiente paso es Stripe Billing con trial y dunning.
- Bizum automático con Redsys no está implementado (Bizum de Stripe sí, si tu cuenta lo tiene).
