import Link from "next/link";
import { requireTenantAnyStatus } from "@/lib/auth";
import { config } from "@/lib/config";
import { Alert, Card, CardBody, btnGhost, btnPrimary } from "@/components/ui";
import { logoutAction } from "@/app/actions/auth";

export const metadata = { title: "Cuenta congelada" };
export const dynamic = "force-dynamic";

export default async function FrozenPage() {
  const { tenant } = await requireTenantAnyStatus();
  const deleteDate = tenant.deleteAt ? tenant.deleteAt.toISOString().slice(0, 10) : null;

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-5 py-10">
      <Card>
        <CardBody className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Cuenta congelada</p>
          <h1 className="text-2xl font-semibold tracking-tight">{tenant.name}</h1>
          <p className="text-sm text-ink-500">
            Tu prueba gratuita ha terminado y la cuenta está en pausa. Tu catálogo público no se muestra y no se
            aceptan reservas ni encargos.
          </p>
          <Alert tone="warn">
            Los datos se conservan {deleteDate ? `hasta el ${deleteDate}` : "14 días"} y después se eliminan de forma
            definitiva conforme al RGPD.
          </Alert>
          <div className="flex flex-wrap gap-2">
            <a href={`mailto:${config.adminEmail}?subject=Quiero%20activar%20mi%20plan%20en%20Vitrio`} className={btnPrimary}>
              Activar mi plan
            </a>
            <form action={logoutAction}>
              <button className={btnGhost}>Cerrar sesión</button>
            </form>
          </div>
          <p className="text-xs text-ink-300">
            ¿Crees que es un error? Escribe a {config.adminEmail} indicando el nombre de tu comercio.
          </p>
        </CardBody>
      </Card>
    </main>
  );
}
