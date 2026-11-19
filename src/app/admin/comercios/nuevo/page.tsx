import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { plans } from "@/db/schema";
import { Card, CardBody, SectionTitle } from "@/components/ui";
import { CreateTenantForm } from "../../forms";

export const metadata = { title: "Nuevo comercio" };
export const dynamic = "force-dynamic";

export default async function NewTenantPage() {
  const planRows = await db.select().from(plans).where(eq(plans.active, true)).orderBy(plans.sortOrder);

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Nuevo comercio"
        hint="Creamos el comercio en prueba, su catálogo público y el usuario del titular."
        action={
          <Link href="/admin/comercios" className="text-sm text-ink-500 hover:text-ink-950">
            ← Volver
          </Link>
        }
      />
      <Card>
        <CardBody>
          <CreateTenantForm plans={planRows} />
        </CardBody>
      </Card>
    </div>
  );
}
