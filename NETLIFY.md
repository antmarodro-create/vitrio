# Desplegar Vitrio gratis: Netlify + Supabase

Stack a coste 0 para la fase de pruebas con empresas y clientes ficticios:

| Pieza | Servicio | Plan | Límites del plan gratuito |
|---|---|---|---|
| Hosting + funciones | **Netlify** | Free | 100 GB/mes de tráfico, 125.000 invocaciones de función, 300 min de build |
| PostgreSQL | **Supabase** | Free | 500 MB de base de datos, proyecto se pausa tras 7 días sin actividad |
| Cobros | **Stripe Connect** | Sin cuota | Solo comisión por operación, **la paga cada comercio** en su cuenta |
| Dominio | `*.netlify.app` | Gratis | Un dominio propio son ~10-15 €/año |

Total: **0 €/mes** mientras sea un entorno de pruebas. Los datos son ficticios y no hay
obligación de facturar todavía.

> **El build no necesita la base de datos.** Todas las páginas que la consultan son dinámicas
> (`/setup` incluida, con `force-dynamic`). Se comprobó compilando un clon limpio **sin ninguna
> variable de entorno**: compila y las rutas salen marcadas como `ƒ (Dynamic)`.

> **Estado actual (19/11/2026):** la base de datos de Supabase ya está creada, migrada y
> verificada (11 tablas, 2 migraciones, 3 planes y **sin usuarios**). La batería completa de
> pruebas (25 comprobaciones) se pasó contra ella. Falta únicamente conectar el repositorio a
> Netlify y crear tu cuenta de administración en `/setup`.

> El cron diario hace una petición a la base de datos todos los días, así que **también evita
> que Supabase pause el proyecto** por inactividad. Es un efecto secundario útil.

---

## 1. Crear la base de datos en Supabase

1. Entra en [supabase.com](https://supabase.com) → **New project**.
   - Nombre: `vitrio`
   - Región: **Frankfurt (eu-central-1)** o **Ireland** (latencia baja desde España)
   - Contraseña de base de datos: guárdala en el gestor. **No es** la contraseña de tu
     usuario de Supabase: es la del rol `postgres` de la base de datos.
2. Espera 1-2 minutos a que el proyecto arranque (verás "Project is ready").
3. Saca la cadena de conexión: botón **Connect** en la barra superior del proyecto (también
   está en **Project Settings → Database → Connection string**). Elige la pestaña
   **Transaction pooler** y copia la cadena. Tiene esta forma:

```
postgresql://postgres.abcdefghijklm:TU_PASSWORD@aws-0-eu-central-1.pooler.supabase.com:6543/postgres
```

Ese `.pooler.supabase.com:6543` es exactamente lo que necesitas: se llama Supavisor, va por
IPv4 y reutiliza conexiones. El detalle completo, con errores típicos y cómo verificarla, está
en el **[Anexo A](#anexo-a-sacar-y-verificar-la-cadena-de-supabase)**.

**Importante — usa el pooler, no la conexión directa.** Las funciones de Netlify son
serverless: abren y cierran conexiones constantemente. El pooler de Supabase las reutiliza y
evita agotar el límite de conexiones. Además, la conexión directa de los proyectos nuevos es
solo IPv6 y las funciones de Netlify no siempre tienen IPv6.

Añade `?sslmode=require` al final si Supabase no lo incluye: Vitrio traduce ese parámetro a TLS
cifrado (`src/lib/pgconfig.ts`). Si prefieres verificar el certificado, descarga la CA de
Supabase y usa `PGSSL_CA=/ruta/supabase-ca.crt` o `sslmode=verify-full`.

## 2. Crear el esquema desde tu máquina

> **Ya está hecho en tu proyecto de Supabase.** Este apartado queda como referencia por si
> creas otro proyecto (por ejemplo, uno limpio para la demo final) o trabajas en otro equipo.

Las migraciones se aplican **una vez desde tu ordenador** apuntando a Supabase (Netlify no
ejecuta nada al arrancar, porque no hay arranque: son funciones).

```bash
git clone <tu-repo> vitrio && cd vitrio
cp .env.example .env
# pega la cadena del pooler en DATABASE_URL (entre comillas, tiene caracteres especiales)
export DATABASE_URL="postgresql://postgres.xxxx:pass@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?sslmode=require"

npm install
npm run db:migrate      # crea las 11 tablas
npm run seed            # planes + superadmin + comercio demo (opcional fuera de producción)
```

Si prefieres no sembrar nada, salta el seed y crea el superadmin en `/setup` al entrar en la
web: los planes por defecto se crean solos ahí.

## 3. Conectar el repositorio a Netlify

1. Sube el proyecto a GitHub (el `netlify.toml` ya está en la raíz).
2. Netlify → **Add new site → Import an existing project** → elige el repo.
   - Build command: `npm run build` (viene de `netlify.toml`)
   - Publish directory: `.next`
   - El plugin oficial de Next.js se instala automáticamente.
3. **Site configuration → Environment variables**:

| Variable | Valor |
|---|---|
| `DATABASE_URL` | cadena del pooler de Supabase (6543, `sslmode=require`) |
| `NEXT_PUBLIC_APP_URL` | `https://tu-sitio.netlify.app` (sin barra final) |
| `ADMIN_EMAIL` | tu email |
| `ADMIN_PASSWORD` | contraseña larga (solo se usa si lanzas el seed) |
| `CRON_SECRET` | cadena aleatoria larga, p. ej. `openssl rand -hex 24` |
| `BUSINESS_TIME_ZONE` | `Europe/Madrid` |
| `SEED_DEMO` | `false` |
| `PG_POOL_MAX` | `3` |
| `STRIPE_SECRET_KEY` | clave **de test** de la cuenta plataforma (`sk_test_...`) |
| `STRIPE_WEBHOOK_SECRET` | secreto del endpoint de webhooks (`whsec_...`) |

4. **Deploy site**. En 2-4 minutos tendrás `https://<nombre>.netlify.app`.
5. Comprueba `https://<nombre>.netlify.app/api/health` → `{"ok":true,"db":"up"}`.
6. Entra en `https://<sitio>.netlify.app/setup` y crea tu cuenta de administración con tu email
   y una contraseña que elijas. **`/setup` solo existe mientras no haya ningún usuario**: en
   cuanto crees el tuyo, desaparece (y redirige a `/login`).
7. Si además quieres el comercio de demostración «Bar La Plaza» (útil para enseñar el producto),
   ejecútalo **después** del paso 6, desde tu máquina:

```bash
npm run db:demo     # crea solo el comercio demo (no toca el superadmin)
```

`NEXT_PUBLIC_APP_URL` se inlinea en el build: si la cambias, **vuelve a desplegar**.

## 4. Cron diario (trial → congelado → borrado)

`netlify/functions/lifecycle.mjs` es una función programada que Netlify ejecuta a diario
(`schedule: "0 4 * * *"`, 04:00 UTC) y que llama a `/api/cron/lifecycle` con `CRON_SECRET`.

- Se despliega sola con el sitio.
- Para probarla: Netlify → **Functions → lifecycle → Run now** (o espera a las 04:00).
- En local: `netlify functions:invoke lifecycle` o
  `curl -H "x-cron-secret: TU_SECRETO" localhost:3000/api/cron/lifecycle`.

## 5. Stripe Connect: cada comercio cobra en su cuenta

Este es el modelo implementado: **cargo directo**. La cuenta de Stripe de Vitrio solo sirve
para crear sesiones de pago y recibir webhooks; el dinero de las ventas entra directamente en
la cuenta del comercio y Vitrio no lo toca.

1. Crea la cuenta de plataforma en [stripe.com](https://stripe.com) (modo test).
2. Panel → **Connect → Get started**: activa Connect con cuentas **Express**. No tiene coste.
3. Copia la clave de test (`sk_test_...`) en `STRIPE_SECRET_KEY` de Netlify.
4. **Developers → Webhooks → Add endpoint**:
   - URL: `https://tu-sitio.netlify.app/api/stripe/webhook`
   - **Marca "Listen to events on connected accounts"** (imprescindible: los pagos ocurren en
     las cuentas de los comercios)
   - Eventos: `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
     `checkout.session.async_payment_failed`, `checkout.session.expired`, `account.updated`
   - Copia el signing secret en `STRIPE_WEBHOOK_SECRET`.
5. Cada comercio entra en `/app/ajustes` → **Conectar mi Stripe** → rellena el alta alojada por
   Stripe → vuelve y pulsa **Actualizar estado**. Cuando el estado sea «Cobrando», puede pedir
   señal en las reservas y cobrar encargos.

En **modo test** Stripe deja completar el alta con datos ficticios (botón "Skip this account
form"), ideal para tus empresas de prueba. Para probar un pago usa la tarjeta `4242 4242 4242 4242`
y cualquier fecha futura y CVC.

### Quién paga qué

| Concepto | Quién cobra | Quién asume la comisión |
|---|---|---|
| Reserva con señal / encargo del cliente final | Comercio, en su cuenta | El comercio (1,5 % + 0,25 € en tarjetas europeas) |
| Cuota mensual o anual de Vitrio | Vitrio, en su cuenta | Vitrio |

La cuota de Vitrio todavía no se cobra automáticamente: «Contratar» registra una solicitud
(`activation_requested`) y se activa a mano desde `/admin`. Cuando quieras automatizarlo, el
siguiente paso es Stripe Billing con las tarifas de 19/39/59 € + IVA y factura anual.

## 6. Comprobación posterior al despliegue

- [ ] `/api/health` → `ok: true`, `db: up`
- [ ] `/setup` completado y contraseña guardada
- [ ] Alta de un comercio de prueba desde `/admin/comercios/nuevo`
- [ ] Reserva y encargo desde el móvil en `/c/<slug>`
- [ ] Conectar Stripe de test en `/app/ajustes` y cobrar con `4242…`
- [ ] Webhook en verde desde el panel de Stripe (evento de prueba)
- [ ] Función `lifecycle` ejecutada a mano sin errores

## 7. Límites y avisos propios de esta combinación

1. **Funciones serverless de Netlify (plan Free)**: 10 s de ejecución por petición y sin
   conexiones de larga duración. Por eso: pooler de Supabase + `PG_POOL_MAX=3` + rate limiting
   en PostgreSQL (no en memoria).
2. **Supabase pausa el proyecto tras 7 días sin actividad.** El cron diario lo evita, pero si
   desactivas el cron, entra en el panel de Supabase y reactívalo antes de una demo.
3. **500 MB de base de datos.** Las fotos de producto se guardan como data URL dentro de
   PostgreSQL: caben unas pocas decenas de comercios, no cientos. El siguiente paso natural es
   moverlas a **Supabase Storage** (también gratis, 1 GB) y guardar solo la URL.
4. **El runtime de Next en Netlify va por detrás de Next 16.** Aquí se ha verificado
   `next build` con la configuración de Netlify (sin `output: standalone`), pero no he podido
   ejecutar el plugin oficial en este entorno. Si Netlify rechazara Next 16, hay dos salidas:
   fijar `next@15` (los cambios son mínimos: no usamos nada exclusivo de 16) o desplegar en
   Vercel/Railway/Render, que ya están preparados en `DEPLOY.md`.
5. **Sin Supabase Auth ni RLS**: Vitrio no usa esas piezas. La autenticación son sesiones
   propias en PostgreSQL, y ninguna consulta se hace desde el navegador: todo pasa por el
   servidor filtrando por comercio. Menos superficie expuesta y ningún `anon key` en el cliente.
6. **No hay previews de rama para la base de datos**: todas las ramas de Netlify usan el mismo
   Supabase. Para pruebas con datos ficticios es suficiente; si algún día quieres entornos
   separados, Supabase permite crear un segundo proyecto gratis.

---

## Anexo A. Sacar y verificar la cadena de Supabase

### A.1. Dónde está exactamente

1. Abre el proyecto en el panel de Supabase.
2. Arriba del todo, junto al nombre del proyecto, pulsa **Connect** (icono de conexión). Si no
   lo ves, ve a **Project Settings → Database** y baja hasta **Connection string**.
3. Verás varias pestañas. Las que importan:

| Pestaña | Host | Puerto | Usuario | Para qué sirve |
|---|---|---|---|---|
| Direct connection | `db.<ref>.supabase.co` | 5432 | `postgres` | Migraciones desde tu portátil. **IPv6** |
| Shared pooler · Session mode | `aws-N-<región>.pooler.supabase.com` | 5432 | `postgres.<ref>` | Alternativa IPv4 a la directa |
| **Shared pooler · Transaction mode** | `aws-N-<región>.pooler.supabase.com` | **6543** | `postgres.<ref>` | **Lo que hay que poner en Netlify** |
| Dedicated pooler | `db.<ref>.supabase.co` | 6543 | `postgres` | Solo planes de pago |

4. Pulsa **Copy** en la pestaña *Transaction pooler*. La cadena sale con
   `[YOUR-PASSWORD]` como marcador: sustitúyelo por la contraseña de la base de datos.

### A.2. Anatomía de la cadena

```
postgresql://postgres.abcdefghijklm:MiClave%402026@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?sslmode=require
└──┬─────┘ └────────┬─────────────┘ └────┬──────┘ └──────────────┬───────────────┘ └┬─┘ └──┬───┘ └──────┬──────┘
 protocolo        usuario             contraseña              host del pooler        puerto  base      cifrado
                postgres.<ref>      codificada                (IPv4, gratuito)       6543
```

- **Usuario**: en el pooler **no** es `postgres`, es `postgres.` + el *Project Ref* (el código
  de la URL del panel). El pooler usa ese sufijo para saber a qué proyecto enrutar. Si pones
  `postgres` a secas, verás `Tenant or user not found`.
- **Contraseña**: si tiene caracteres reservados (`@ # ? / : %` o espacios) hay que
  codificarlos. Para eso no hace falta adivinar: abre la consola del navegador (F12) en el panel
  de Supabase y ejecuta `encodeURIComponent('TU_CLAVE')`; pega el resultado. En terminal:

```bash
node -e "console.log(encodeURIComponent(process.argv[1]))" 'MiClave@2026'
# MiClave%402026
```

- **Host del pooler**: no se puede componer a mano a partir de la región: el número
  (`aws-0`, `aws-1`…) cambia según el proyecto. Cópialo del panel.
- **Puerto 6543** = transaction mode. **Puerto 5432** en el host del pooler = session mode.
- **`?sslmode=require`**: obligatorio con Supabase. Sin él, la conexión se rechaza o falla el
  cifrado.

### A.3. Verificarla antes de tocar Netlify

El proyecto incluye un comprobador que no escribe nada:

```bash
export DATABASE_URL="postgresql://postgres.xxxx:CLAVE@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?sslmode=require"
npm run db:check
```

Salida esperada:

```
Destino:
  host      aws-0-eu-central-1.pooler.supabase.com
  puerto    6543
  usuario   postgres.xxxx
  base      postgres
  TLS       require

✓ Conexion correcta en 180 ms
  PostgreSQL 17.x
  base: postgres · usuario postgres.xxxx
  TLS activo: si
  tablas en public: 0
  migraciones aplicadas: sin tabla de migraciones

→ La base esta vacia: ejecuta `npm run db:migrate`.
```

Si sale eso, la cadena es correcta. Después:

```bash
npm run db:migrate   # crea las 11 tablas
npm run db:check     # ahora: tablas en public: 11 · migraciones aplicadas: 2
npm run seed         # opcional: planes + superadmin + comercio demo
```

También puedes probarla sin la app, con `psql` si lo tienes instalado:

```bash
psql "postgresql://postgres.xxxx:CLAVE@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?sslmode=require" -c "select version();"
```

### A.4. Errores típicos y qué significan

| Mensaje | Causa | Solución |
|---|---|---|
| `Tenant or user not found` | usuario sin `.<ref>` o proyecto equivocado | usa `postgres.<ref>` del panel |
| `password authentication failed` | contraseña mal, o `@`/`#` sin codificar | resetea en **Project Settings → Database** y codifica la clave |
| `self-signed certificate in certificate chain` | TLS sin aceptar la CA de Supabase | añade `?sslmode=require` (o `PGSSL_CA`) |
| `ENETUNREACH` / `EHOSTUNREACH` / no resuelve | estás en la conexión **directa**, que es IPv6 | cambia al host `*.pooler.supabase.com` |
| `timeout expired` / se queda colgado | proyecto **pausado** (7 días sin uso en Free) | ábrelo en el panel y espera 1 min |
| `too many clients already` / `max client connections` | demasiadas conexiones directas | pooler 6543 + `PG_POOL_MAX=3` |
| `relation "tenants" does not exist` | te has conectado bien pero sin migrar | `npm run db:migrate` |

### A.5. ¿Y no rompe nada usar transaction mode?

No, en este proyecto está comprobado:

- **Sin sentencias preparadas con nombre**: `pg` (node-postgres) envía consultas parametrizadas
  sin preparar, que es lo compatible con transaction mode. (Si algún día cambias a un driver que
  prepare sentencias, necesitarás session mode.)
- **Bloqueo de reservas**: usamos `pg_advisory_xact_lock`, que es *de transacción*. En
  transaction mode la transacción entera va por una sola conexión del pool, así que el bloqueo
  sigue siendo correcto. Un `pg_advisory_lock` de sesión **no** lo sería.
- **Migraciones**: se lanzan desde tu máquina con `npm run db:migrate`; si prefieres máxima
  compatibilidad para DDL, usa para ese comando la cadena *Session pooler* (5432) o la directa.

### A.6. Seguridad

La cadena contiene la contraseña de la base de datos en claro:

- Guárdala solo en las variables de entorno de Netlify y en tu `.env` local (que está en
  `.gitignore`).
- No la pongas nunca en una variable `NEXT_PUBLIC_*` ni la pegues en el navegador.
- Si la filtras, resetea la contraseña en **Project Settings → Database → Reset database
  password** y actualiza Netlify.
