import Link from "next/link";
import { Card, CardBody } from "@/components/ui";

export const metadata = { title: "Aviso legal" };

/**
 * BORRADOR. Sustituir los datos entre corchetes por los reales del titular y
 * revisar con un profesional antes de facturar. Ver LEEME.md (pendientes).
 */
export default function LegalPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      <Link href="/" className="text-xs text-ink-500 hover:text-ink-950">
        ← Vitrio
      </Link>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">Aviso legal y privacidad</h1>
      <p className="mt-1 text-sm text-ink-500">
        Documento en borrador: los datos entre corchetes deben completarse antes de la puesta en producción.
      </p>

      <div className="mt-6 space-y-4">
        <Card>
          <CardBody className="space-y-2 text-sm text-ink-700">
            <h2 className="text-base font-semibold text-ink-950">Titular del servicio</h2>
            <p>
              [NOMBRE O RAZÓN SOCIAL], NIF [NIF], domicilio en [DIRECCIÓN], correo [EMAIL]. Vitrio es una plataforma
              de catálogo, reservas y encargos para comercios locales.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="space-y-2 text-sm text-ink-700">
            <h2 className="text-base font-semibold text-ink-950">Datos que tratamos</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>Datos del comercio: nombre, dirección, contacto y datos de facturación.</li>
              <li>Datos de usuarios del panel: email y contraseña cifrada (scrypt).</li>
              <li>
                Datos de clientes finales que reservan o encargan: nombre, teléfono y, opcionalmente, email, apuntes y
                el detalle del pedido.
              </li>
              <li>Datos técnicos: registros de acceso y eventos de uso (escaneos de QR, reservas, pagos).</li>
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="space-y-2 text-sm text-ink-700">
            <h2 className="text-base font-semibold text-ink-950">Base jurídica y conservación</h2>
            <p>
              Ejecución de un contrato (prestación del servicio y gestión de reservas o encargos) e interés legítimo
              en la seguridad de la plataforma. Los datos se conservan mientras la cuenta esté activa. Al finalizar la
              prueba sin contratación se aplica un periodo de gracia de 14 días y después se procede al borrado.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="space-y-2 text-sm text-ink-700">
            <h2 className="text-base font-semibold text-ink-950">Encargados del tratamiento</h2>
            <p>
              Alojamiento: [PROVEEDOR]. Pagos: Stripe Payments Europe (cuando se configure). Email transaccional:
              Resend. Los pagos con tarjeta y Bizum se procesan íntegramente en Stripe; Vitrio no almacena datos de
              tarjeta.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="space-y-2 text-sm text-ink-700">
            <h2 className="text-base font-semibold text-ink-950">Derechos</h2>
            <p>
              Puedes ejercer los derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad
              escribiendo a [EMAIL]. También puedes reclamar ante la Agencia Española de Protección de Datos.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="space-y-2 text-sm text-ink-700">
            <h2 className="text-base font-semibold text-ink-950">Cookies</h2>
            <p>
              Solo usamos una cookie técnica de sesión (<code>vitrio_session</code>), HttpOnly, necesaria para
              mantener la sesión iniciada. No se usan cookies publicitarias ni de perfilado.
            </p>
          </CardBody>
        </Card>
      </div>
    </main>
  );
}
