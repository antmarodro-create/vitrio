# Showroom: comercios de demostración

Tres comercios ficticios, uno por plan, para enseñar el producto y que el cliente vea la
diferencia entre planes. Datos, fotos y nombres son inventados.

| Comercio | URL | Plan | Qué demuestra |
|---|---|---|---|
| **Bodega Lumière** | `/c/bodega-lumiere` | Pro (39 €) | Carta con fotos, reserva de mesa con señal de 15 €, encargos con recogida, WhatsApp |
| **Salón Ébano** | `/c/salon-ebano` | Premium (59 €) | Cita por servicio con duración, señales, tienda de producto, reseñas |
| **Lumen Panadería** | `/c/lumen-panaderia` | Básico (19 €) | Catálogo + QR y, a la vista, lo que **no** incluye su plan |

Paneles de los tres: `lumiere@vitrio.app`, `ebano@vitrio.app`, `lumen@vitrio.app` —
contraseña `demo1234`.

## Cómo se cargan

```bash
npm run demo:showroom
```

Es idempotente: borra y recrea solo esos tres comercios, con sus productos, reservas
pendientes, encargos y escaneos de QR de los últimos días. Usa las fotos de
`public/demo/` y las guarda en la base como data URL, igual que hace el comercio real
cuando sube una foto desde el panel.

Contra la base de Supabase (el sitio de Netlify):

```bash
DATABASE_URL="postgresql://postgres.<ref>:clave@aws-N-<region>.pooler.supabase.com:6543/postgres?sslmode=require" \
  npm run demo:showroom
```

> **Orden importante:** primero entra en `/setup` del sitio desplegado y crea tu cuenta de
> administración. En cuanto exista un usuario, `/setup` se cierra, y los comercios de demo
> crean sus propios usuarios.

## El circuito completo, en 90 segundos

1. Abre `/c/bodega-lumiere/reservar`, elige día y hora y reserva con un nombre cualquiera.
2. Verás una página de seguimiento con tu código y la traza **«Solicitud enviada al comercio»**.
3. Entra en el panel con `lumiere@vitrio.app` / `demo1234` y abre **Bandeja**.
4. La reserva está ahí con nombre, teléfono, comensales y notas. Pulsa **Confirmar**.
5. Vuelve a la página de seguimiento del cliente: ahora pone **«Reserva confirmada»** y
   aparece la segunda traza con su hora.

Eso es lo que el cliente final compra: no un formulario que se pierde, sino un mensaje que
llega al comercio y una confirmación que el cliente puede ver.

## Qué mirar en cada plan

- **Básico**: la carta se ve perfecta, pero la franja de invitación explica que su plan no
  incluye reservas ni encargos. Sirve para vender Pro.
- **Pro**: reserva de mesa con aforo (24 comensales), dos turnos, señal del 15 % descontable
  y encargos con hora de recogida.
- **Premium**: la web abre con las **citas por delante de la tienda** (así lo ordena el tipo
  de negocio «belleza»), servicios con duración y señal distinta por servicio, y tienda de
  producto con encargo.

## Personalización visual

Cada comercio tiene portada (`coverData`), frase corta (`tagline`), logo y color. Se editan
en **Panel → Ajustes → Perfil del comercio**. La portada, la frase y el logo son lo que
convierte la web en «suya»: sin ellos la cabecera cae a un degradado con su color.
