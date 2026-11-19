# Stripe en modo test (Connect, cargo directo)

Objetivo: que la señal de 15 € de la Bodega Lumière se pueda pagar de verdad con
`4242 4242 4242 4242` y que el dinero aparezca **en la cuenta del comercio**, no en la de
Vitrio. En modo test no se mueve dinero real.

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
2. **Ajustes → Cobros** → *Conectar Stripe*. Se crea la cuenta Express y te lleva a Stripe.
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
