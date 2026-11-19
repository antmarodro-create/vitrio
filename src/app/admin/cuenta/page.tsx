import Link from "next/link";
import { requireSuperadmin } from "@/lib/auth";
import { config, stripeEnabled } from "@/lib/config";
import { Alert, Card, CardBody, SectionTitle, btnGhost } from "@/components/ui";
import { logoutAction } from "@/app/actions/auth";

export const metadata = { title: "Cuenta" };
export const dynamic = "force-dynamic";

export default async function AdminAccountPage() {
  const { user } = await requireSuperadmin();

  return (
    <div className="space-y-6">
      <SectionTitle title="Cuenta de administración" />

      <Card>
        <CardBody>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-ink-500">Email</dt>
              <dd className="font-medium">{user.email}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-500">Rol</dt>
              <dd className="font-medium">Superadmin</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-500">Último acceso</dt>
              <dd>{user.lastLoginAt ? user.lastLoginAt.toISOString().slice(0, 16).replace("T", " ") : "—"}</dd>
            </div>
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/cuenta/contrasena" className={btnGhost}>
              Cambiar contraseña
            </Link>
            <form action={logoutAction}>
              <button className={btnGhost}>Cerrar sesión</button>
            </form>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <SectionTitle title="Configuración del entorno" hint="Se lee de variables de entorno." />
          <ul className="space-y-2 text-sm">
            <li className="flex items-center justify-between gap-4">
              <span className="text-ink-500">URL pública</span>
              <code className="rounded bg-black/5 px-2 py-0.5 text-xs">{config.appUrl}</code>
            </li>
            <li className="flex items-center justify-between gap-4">
              <span className="text-ink-500">Stripe Connect (plataforma)</span>
              <span className="font-medium">{stripeEnabled() ? "Clave de plataforma cargada" : "Sin configurar"}</span>
            </li>
            <li className="flex items-center justify-between gap-4">
              <span className="text-ink-500">Email transaccional</span>
              <span className="font-medium">{config.resendKey ? "Resend" : "Solo log"}</span>
            </li>
            <li className="flex items-center justify-between gap-4">
              <span className="text-ink-500">Cron de ciclo de vida</span>
              <span className="font-medium">{config.cronSecret ? "Protegido con secreto" : "Sin secreto"}</span>
            </li>
          </ul>
          {!stripeEnabled() ? (
            <div className="mt-4">
              <Alert tone="warn">
                Sin <code>STRIPE_SECRET_KEY</code> y <code>STRIPE_WEBHOOK_SECRET</code> los comercios no pueden conectar su
                cuenta: las reservas se confirman sin señal y los encargos se pagan en el local.
              </Alert>
            </div>
          ) : null}
        </CardBody>
      </Card>
    </div>
  );
}
