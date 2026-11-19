import { redirect } from "next/navigation";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { config } from "@/lib/config";
import { Card, CardBody } from "@/components/ui";
import { SetupForm } from "@/components/auth-forms";
import { ensureDefaultPlans } from "@/lib/bootstrap";

export const metadata = { title: "Primera configuración" };

// Lee la tabla de usuarios en cada visita: si se prerenderizara, seguiria mostrando el
// formulario cuando ya existe el superadmin, y ademas obligaria a tener BD en el build.
export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const rows = await db.select({ n: sql<number>`count(*)::int` }).from(users);
  if ((rows[0]?.n ?? 0) > 0) redirect("/login");

  // Deja los planes por defecto listos en una instalacion nueva
  await ensureDefaultPlans();

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Primera puesta en marcha</p>
        <h1 className="serif mt-1 text-3xl leading-tight">Crea la cuenta de administración</h1>
        <p className="mt-1 text-sm text-ink-500">
          Este formulario solo aparece mientras no exista ningún usuario. El superadmin da de alta los comercios;
          no hay registro público.
        </p>
      </div>
      <Card>
        <CardBody>
          <SetupForm defaultEmail={config.adminEmail} />
        </CardBody>
      </Card>
    </main>
  );
}
