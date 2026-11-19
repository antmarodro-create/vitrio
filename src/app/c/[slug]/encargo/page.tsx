import { notFound } from "next/navigation";
import { getPublicTenant } from "@/lib/public";
import { planHas } from "@/lib/plans";
import { tenantCanCharge } from "@/lib/stripe";
import { Empty } from "@/components/ui";
import { CartForm } from "../cart-form";

export const dynamic = "force-dynamic";

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ add?: string }>;
}) {
  const { slug } = await params;
  const { add } = await searchParams;
  const data = await getPublicTenant(slug);
  if (!data) notFound();
  const { tenant, plan, products } = data;

  if (!tenant.ordersEnabled || !planHas(plan, "orders")) {
    return <Empty title="Encargos no disponibles" hint="Este comercio no acepta encargos online ahora mismo." />;
  }

  const sellable = products.filter((p) => p.priceCents > 0);
  if (!sellable.length) {
    return <Empty title="Sin productos para encargar" hint="Prueba a ver el catálogo completo." />;
  }

  const requiresPayment =
    planHas(plan, "payments") &&
    tenantCanCharge(tenant) &&
    (tenant.paymentCardEnabled || tenant.paymentBizumEnabled);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Hacer encargo</h1>
        <p className="text-sm text-ink-500">
          Elige productos y la hora. {requiresPayment ? "El pago se hace al confirmar." : "El pago se hace al recoger."}
        </p>
      </div>
      <CartForm
        slug={slug}
        products={sellable}
        initialAdd={add}
        noticeHours={tenant.orderNoticeHours}
        policy={tenant.policyText}
        requiresPayment={requiresPayment}
      />
    </div>
  );
}
