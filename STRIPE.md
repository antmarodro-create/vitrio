# Stripe en modo test (Connect, cargo directo)

Objetivo: que la señal de 15 € de la Bodega Lumière se pueda pagar de verdad con
`4242 4242 4242 4242` y que el dinero aparezca **en la cuenta del comercio**, no en la de
Vitrio. En modo test no se mueve dinero real.



## Cuentas conectadas v2 (lo que Stripe exige desde 2026)

Si ves este error al pulsar «Conectar mi Stripe»:

> You tried to create an Accounts v1 connected account using the legacy `type` field with your
> platform as the losses collector.

Es que Stripe ya no acepta `type: "express"` en plataformas nuevas: hay que usar **Accounts v2**.
El código ya está migrado (`src/lib/stripe.ts`):

```ts
stripe.v2.core.accounts.create({
  contact_email, display_name, dashboard: "express",
  identity: { country: "es" },
  configuration: {
    merchant: { capabilities: { card_payments: { requested: true } } },
    recipient: { capabilities: { stripe_balance: { stripe_transfers: { requested: true } } } },
  },
  defaults: {
    currency: "eur",
    locales: ["es-ES"],
    // El comercio paga las comisiones de sus cobros; Stripe asume el riesgo de
    // saldos negativos. Vitrio no responde de las deudas del comercio.
    responsibilities: { fees_collector: "stripe", losses_collector: "stripe" },
  },
})
```

Y el alta se abre con `stripe.v2.core.accountLinks.create({ account, use_case: { type:
"account_onboarding", account_onboarding: { refresh_url, return_url } } })`.

**Consecuencias prácticas:**

- La cuenta **puede cobrar** cuando `configuration.merchant.capabilities.card_payments.status`
  es `active`. Antes de terminar el alta está en `restricted`.
- Los eventos de cuentas v2 **no se pueden suscribir en un webhook endpoint** (`v2.core.account…`
  se rechaza). Por eso el estado se sincroniza de forma activa: al volver del alta
  (`?stripe=ok`), con el botón *Actualizar estado* y en el cron diario de las 04:00.
- El webhook sigue escuchando `account.updated` para las cuentas antiguas creadas con la v1.


## Quién es quién: dos cuentas, y solo una cobra

Es la duda más habitual al empezar con Connect. Hay **dos** cuentas de Stripe en juego:

| | Cuenta de plataforma | Cuenta conectada |
|---|---|---|
| De quién es | De Vitrio (tuya) | De cada comercio |
| Para qué sirve | Crear sesiones de pago y recibir webhooks | Recibir el dinero de sus ventas |
| Quién la abre | Tú, en stripe.com | Tu código, con una llamada a la API |
| Qué datos pide | En test, ninguno. En live, identificación de la plataforma | NIF, IBAN, teléfono: los rellena el comercio en un formulario |
| Saldo por una reserva | 0 € | El importe íntegro, menos la comisión de Stripe |
| Aparece en el extracto del cliente | No | Sí: el nombre del comercio |

El código usa **cargo directo**:

```ts
stripe.checkout.sessions.create({ ... }, { stripeAccount: tenant.stripeAccountId })
```

La sesión se crea *en la cuenta del comercio*, y no se envía `application_fee_amount`, así que la
plataforma no retiene nada. Las comisiones de Stripe (1,5 % + 0,25 € en tarjetas europeas) las
asume el comercio. El comercio es el vendedor y quien factura; Vitrio es el software.

**No existe la opción de no tener cuenta de plataforma**: la clave `sk_…` con la que se crean los
pagos es siempre de una cuenta. Lo que sí es cierto es que esa cuenta no cobra nada de las
reservas, y que en modo test no necesita ninguna verificación.

Solo entraría dinero en la cuenta de plataforma si algún día:

- se cobra la **cuota mensual** de Vitrio con Stripe Billing (ese dinero sí es tuyo), o
- se añade una **comisión por venta** con `application_fee_amount` (hoy está a 0 por decisión
  de producto: «sin comisiones por venta» es una promesa de la web).

## Las tres piezas

| Pieza | Dónde se configura | Variable |
|---|---|---|
| Clave secreta de la **plataforma** (Vitrio) | Netlify y `.env` local | `STRIPE_SECRET_KEY` (`sk_test_…`) |
| Secreto del **webhook** | Netlify y `.env` local | `STRIPE_WEBHOOK_SECRET` (`whsec_…`) |
| Cuenta **conectada** de cada comercio | Se crea desde el panel, no es variable | guardada en `tenants.stripe_account_id` |

Vitrio nunca retiene el dinero: crea la sesión de pago **en la cuenta del comercio**. Es lo
que Stripe llama *direct charges*. Las comisiones de Stripe las asume el comercio y la cuota
de Vitrio se factura aparte.

## Paso 1 · Activar Connect en modo test

1. Dashboard de Stripe → **Connect** → *Get started*.
2. Arriba a la izquierda, comprueba que el interruptor dice **Test mode** (naranja).
3. Rellena solo lo mínimo de la plataforma: nombre comercial (aparece en el extracto del
   cliente) y URL `https://tu-sitio.netlify.app`.
4. En *Connect → Settings*, deja activado **Express** como tipo de cuenta.

## Paso 2 · Claves

Dashboard → **Developers → API keys** (con Test mode activo):

```
STRIPE_SECRET_KEY = sk_test_...
```

En Netlify: *Site configuration → Environment variables → Add a variable*, y **redeploy**
(las funciones solo leen las variables en el despliegue).

En local, en `.env`.

## Paso 3 · Webhook

Dashboard → **Developers → Webhooks → Add endpoint**:

- URL: `https://TU-SITIO.netlify.app/api/stripe/webhook`
- Eventos (los cuatro que entiende la app):

```
checkout.session.completed
checkout.session.async_payment_succeeded
checkout.session.async_payment_failed
checkout.session.expired
account.updated
```

- **Importante:** marca *Listen to events on Connected accounts*. Los eventos de las cuentas
  conectadas traen el campo `event.account`, y sin esa marca el pago nunca se daría por cobrado.
- Copia el *Signing secret* (`whsec_…`) en `STRIPE_WEBHOOK_SECRET`.

En local, sin exponer nada:

```bash
stripe login
stripe listen --forward-to localhost:3000/api/stripe/webhook
# imprime: Ready! Your webhook signing secret is whsec_...
```

## Paso 4 · Alta del comercio (cuenta Express)

1. Entra en el panel con `lumiere@vitrio.app` / `demo1234`.
2. **Ajustes → Cobros** → *Conectar Stripe*. Se crea la cuenta (v2, dashboard Express) y te lleva al formulario de Stripe.
3. Rellena el formulario con **datos de prueba**:

| Campo | Valor de test |
|---|---|
| Teléfono | `000 000 0000` |
| Dirección | `Calle Falsa 123` |
| CIF / NIF | `00000000T` |
| Fecha de nacimiento | `01 / 01 / 1990` |
| IBAN | `ES89 3700 0000 0000 0000 0000` |
| Código SMS | `000 000` |

4. Al volver, el panel debe mostrar **«Cuenta conectada · puede cobrar»**. Si dice «datos
   enviados, sin activar», espera un minuto o revisa que no falte ningún dato obligatorio.

## Paso 5 · Cobrar de verdad (test)

1. En `/c/bodega-lumiere/reservar` reserva una mesa: la ficha pedirá **señal de 15 €**.
2. En el Checkout de Stripe usa:

```
Tarjeta   4242 4242 4242 4242
Caducidad cualquier fecha futura (12/34)
CVC       cualquier 3 dígitos
Titular   lo que sea
```

3. Vuelve a la app: la reserva muestra **Pagado** y el seguimiento añade *«Pago recibido»*.
4. Verifícalo en Stripe: **Connect → Connected accounts → la cuenta del comercio → Payments**.
   El pago tiene que estar **ahí**, no en la cuenta de la plataforma. Eso demuestra el cargo
   directo.

Otras tarjetas útiles: `4000 0000 0000 0002` (rechazo), `4000 0025 0000 3155` (pide
autenticación 3D Secure), `5555 5555 5555 4444` (Mastercard).

## Paso 6 · Devoluciones

Desde la app no se cancela un pago ya cobrado a propósito. Para devolver:

Stripe → Connect → cuenta del comercio → **Payments** → el pago → **Refund**.

Después, en el panel del comercio, cancela la reserva a mano.

## Comprobarlo todo de una vez

```bash
npm run stripe:check
```

Verifica que la clave responde (y si es de test o de producción), que Connect está activado,
qué cuentas conectadas hay y si alguna puede cobrar, y si el secreto del webhook tiene forma
válida. Sale con código 1 si algo impide cobrar.

```bash
# contra el sitio desplegado, con las claves de Netlify
STRIPE_SECRET_KEY=sk_test_... STRIPE_WEBHOOK_SECRET=whsec_... node scripts/stripe-check.mjs
```

## Señales de que algo está mal

| Síntoma | Causa | Arreglo |
|---|---|---|
| La reserva no pide señal | El comercio no tiene `charges_enabled` | Terminar el alta Express en Ajustes |
| Pago hecho pero sigue «pendiente» | El webhook no llega o no escucha cuentas conectadas | Revisar la marca *Connected accounts* y `STRIPE_WEBHOOK_SECRET` |
| El endpoint devuelve 503 | Falta `STRIPE_WEBHOOK_SECRET` en el despliegue | Añadirla y redesplegar |
| «Stripe no está configurado» | Falta `STRIPE_SECRET_KEY` | Añadirla y redesplegar |
| El dinero aparece en la plataforma | Se usó la cuenta de la plataforma como destino | Comprobar `createCheckout({ stripeAccount })` |

## El aviso naranja del panel

Si la clave empieza por `sk_test_`, el panel y el admin muestran una franja **«Modo test»**:
los cobros son ficticios. Desaparece sola al poner una clave `sk_live_`.
