"use client";

import { useActionState } from "react";
import {
  createPlanAction,
  createTenantAction,
  deleteTenantAction,
  resetOwnerPasswordAction,
  savePlanAction,
  updateTenantAction,
  type AdminState,
} from "./actions";
import { Alert, Field, btnBrand, btnDanger, btnGhost, btnPrimary, inputClass } from "@/components/ui";
import type { Plan, Tenant } from "@/db/schema";
import { BUSINESS_TYPES } from "@/lib/plans";

const initial: AdminState = { error: null };

function Credentials({ credentials }: { credentials: NonNullable<AdminState["credentials"]> }) {
  return (
    <Alert tone="success">
      <p className="font-semibold">Credenciales de acceso (se muestran una sola vez)</p>
      <p className="mt-1 font-mono text-xs">{credentials.email}</p>
      <p className="font-mono text-xs">{credentials.password}</p>
      <p className="mt-1 text-xs">El titular deberá cambiar la contraseña al entrar.</p>
    </Alert>
  );
}

export function CreateTenantForm({ plans, defaultTrialDays = 30 }: { plans: Plan[]; defaultTrialDays?: number }) {
  const [state, action, pending] = useActionState(createTenantAction, initial);

  return (
    <form action={action} className="space-y-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.ok ? <Alert tone="success">{state.ok}</Alert> : null}
      {state.credentials ? <Credentials credentials={state.credentials} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre del comercio">
          <input className={inputClass} name="name" required placeholder="Bar La Plaza" />
        </Field>
        <Field label="Dirección web (opcional)" hint="Se genera sola. Queda como /c/direccion">
          <input className={inputClass} name="slug" placeholder="bar-la-plaza" />
        </Field>
        <Field label="Tipo de comercio">
          <select className={inputClass} name="businessType" defaultValue="bar">
            {Object.entries(BUSINESS_TYPES).map(([key, value]) => (
              <option key={key} value={key}>
                {value.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Plan de partida">
          <select className={inputClass} name="planId" defaultValue={plans.find((p) => p.slug === "pro")?.id ?? ""}>
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Email del titular" hint="Recibirá la contraseña temporal.">
          <input className={inputClass} type="email" name="ownerEmail" required placeholder="dueno@bar.com" />
        </Field>
        <Field label="Nombre del titular">
          <input className={inputClass} name="ownerName" placeholder="Marta Ruiz" />
        </Field>
        <Field label="Teléfono">
          <input className={inputClass} name="phone" placeholder="600 000 000" />
        </Field>
        <Field label="WhatsApp" hint="Solo dígitos con prefijo, para wa.me">
          <input className={inputClass} name="whatsapp" placeholder="34600000000" />
        </Field>
        <Field label="Dirección">
          <input className={inputClass} name="address" placeholder="Calle Mayor 3" />
        </Field>
        <Field label="Ciudad">
          <input className={inputClass} name="city" placeholder="Alicante" />
        </Field>
        <Field label="Días de prueba">
          <input className={inputClass} type="number" name="trialDays" min={1} max={90} defaultValue={defaultTrialDays} />
        </Field>
      </div>

      <button className={btnPrimary} disabled={pending}>
        {pending ? "Creando…" : "Crear comercio"}
      </button>
    </form>
  );
}

export function TenantEditForm({ tenant, plans }: { tenant: Tenant; plans: Plan[] }) {
  const [state, action, pending] = useActionState(updateTenantAction, initial);
  return (
    <form action={action} className="space-y-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.ok ? <Alert tone="success">{state.ok}</Alert> : null}
      <input type="hidden" name="tenantId" value={tenant.id} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre">
          <input className={inputClass} name="name" defaultValue={tenant.name} required />
        </Field>
        <Field label="Plan">
          <select className={inputClass} name="planId" defaultValue={tenant.planId ?? ""}>
            <option value="">Sin plan</option>
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name} · {plan.priceMonthlyCents / 100} €/mes
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tipo">
          <select className={inputClass} name="businessType" defaultValue={tenant.businessType}>
            {Object.entries(BUSINESS_TYPES).map(([key, value]) => (
              <option key={key} value={key}>
                {value.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Email del titular">
          <input className={inputClass} name="ownerEmail" defaultValue={tenant.ownerEmail ?? ""} />
        </Field>
        <Field label="Nombre del titular">
          <input className={inputClass} name="ownerName" defaultValue={tenant.ownerName ?? ""} />
        </Field>
        <Field label="Teléfono">
          <input className={inputClass} name="phone" defaultValue={tenant.phone ?? ""} />
        </Field>
        <Field label="WhatsApp">
          <input className={inputClass} name="whatsapp" defaultValue={tenant.whatsapp ?? ""} />
        </Field>
        <Field label="Ciudad">
          <input className={inputClass} name="city" defaultValue={tenant.city ?? ""} />
        </Field>
      </div>
      <button className={btnGhost} disabled={pending}>
        {pending ? "Guardando…" : "Guardar cambios"}
      </button>
    </form>
  );
}

export function ResetPasswordForm({ tenantId }: { tenantId: string }) {
  const [state, action, pending] = useActionState(resetOwnerPasswordAction, initial);
  return (
    <form action={action} className="space-y-3">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.credentials ? <Credentials credentials={state.credentials} /> : null}
      <input type="hidden" name="tenantId" value={tenantId} />
      <button className={btnGhost} disabled={pending}>
        {pending ? "Generando…" : "Restablecer contraseña del titular"}
      </button>
    </form>
  );
}

export function DeleteTenantForm({ tenantId }: { tenantId: string }) {
  const [state, action, pending] = useActionState(deleteTenantAction, initial);
  return (
    <form action={action} className="space-y-3">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.ok ? <Alert tone="success">{state.ok}</Alert> : null}
      <input type="hidden" name="tenantId" value={tenantId} />
      <Field label="Escribe BORRAR para confirmar" hint="Borra reservas, encargos y productos, y anonimiza la ficha. No se puede deshacer.">
        <input className={inputClass} name="confirm" placeholder="BORRAR" />
      </Field>
      <button className={btnDanger} disabled={pending}>
        {pending ? "Borrando…" : "Borrar y anonimizar"}
      </button>
    </form>
  );
}

export function PlanForm({ plan }: { plan: Plan }) {
  const [state, action, pending] = useActionState(savePlanAction, initial);
  const features = plan.features ?? {};
  const keys = ["catalog", "qr", "bookings", "orders", "payments", "whatsapp", "stats", "reviews"];
  return (
    <form action={action} className="space-y-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.ok ? <Alert tone="success">{state.ok}</Alert> : null}
      <input type="hidden" name="planId" value={plan.id} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre">
          <input className={inputClass} name="name" defaultValue={plan.name} />
        </Field>
        <Field label="Precio mensual (€, sin IVA)">
          <input className={inputClass} name="priceMonthly" defaultValue={(plan.priceMonthlyCents / 100).toFixed(2)} />
        </Field>
        <Field label="Precio anual (€, sin IVA)">
          <input className={inputClass} name="priceYearly" defaultValue={(plan.priceYearlyCents / 100).toFixed(2)} />
        </Field>
        <Field label="Máx. productos" hint="Vacío = sin límite">
          <input className={inputClass} name="maxProducts" defaultValue={plan.maxProducts ?? ""} />
        </Field>
        <Field label="Máx. reservas/mes" hint="Vacío = sin límite">
          <input className={inputClass} name="maxBookingsMonth" defaultValue={plan.maxBookingsMonth ?? ""} />
        </Field>
      </div>
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink-700">Funciones incluidas</legend>
        <div className="grid grid-cols-2 gap-2">
          {keys.map((key) => (
            <label key={key} className="flex items-center gap-2 rounded-lg border border-black/10 px-3 py-2 text-sm">
              <input type="checkbox" name={`feature_${key}`} defaultChecked={Boolean(features[key])} />
              {key}
            </label>
          ))}
        </div>
      </fieldset>
      <button className={btnBrand} disabled={pending}>
        {pending ? "Guardando…" : "Guardar plan"}
      </button>
    </form>
  );
}

export function CreatePlanForm() {
  const [state, action, pending] = useActionState(createPlanAction, initial);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.ok ? <Alert tone="success">{state.ok}</Alert> : null}
      <Field label="Nombre del nuevo plan" className="min-w-48 flex-1">
        <input className={inputClass} name="name" required placeholder="Premium Plus" />
      </Field>
      <Field label="€/mes">
        <input className={inputClass} name="priceMonthly" defaultValue="79.00" />
      </Field>
      <Field label="€/año">
        <input className={inputClass} name="priceYearly" defaultValue="790.00" />
      </Field>
      <button className={btnGhost} disabled={pending}>
        {pending ? "Creando…" : "Crear plan"}
      </button>
    </form>
  );
}
