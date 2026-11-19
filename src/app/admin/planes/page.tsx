import { db } from "@/lib/db";
import { plans } from "@/db/schema";
import { Badge, Card, CardBody, SectionTitle, btnSmall } from "@/components/ui";
import { CreatePlanForm, PlanForm } from "../forms";
import { togglePlanActiveAction } from "../actions";

export const metadata = { title: "Planes" };
export const dynamic = "force-dynamic";

export default async function PlansPage() {
  const rows = await db.select().from(plans).orderBy(plans.sortOrder);

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Planes y precios"
        hint="Los precios se muestran sin IVA. El plan define funciones y límites; el comercio no puede cambiarlos."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {rows.map((plan) => (
          <Card key={plan.id}>
            <CardBody>
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{plan.name}</h3>
                  <span className="text-xs text-ink-500">/{plan.slug}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={plan.active ? "green" : "neutral"}>{plan.active ? "Disponible" : "Oculto"}</Badge>
                  <form action={togglePlanActiveAction}>
                    <input type="hidden" name="planId" value={plan.id} />
                    <button className={`${btnSmall} rounded-lg border border-black/10 px-2 py-1 text-xs`}>
                      {plan.active ? "Ocultar" : "Publicar"}
                    </button>
                  </form>
                </div>
              </div>
              <PlanForm plan={plan} />
            </CardBody>
          </Card>
        ))}
      </div>

      <Card>
        <CardBody>
          <SectionTitle title="Crear plan" hint="Útil para lanzar una tarifa nueva sin tocar código." />
          <CreatePlanForm />
        </CardBody>
      </Card>
    </div>
  );
}
