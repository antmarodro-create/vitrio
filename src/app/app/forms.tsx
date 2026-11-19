"use client";

import { useActionState } from "react";
import {
  createManualBookingAction,
  saveProfileAction,
  saveProductAction,
  saveSettingsAction,
  type AppState,
} from "./actions";
import { Alert, Field, btnBrand, btnGhost, inputClass } from "@/components/ui";
import type { Product, Tenant } from "@/db/schema";
import { weekdayName } from "@/lib/time";

const initial: AppState = { error: null };

export function ProductForm({ product, kind }: { product?: Product; kind: "product" | "service" }) {
  const [state, action, pending] = useActionState(saveProductAction, initial);
  const isService = kind === "service";

  return (
    <form action={action} className="space-y-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.ok ? <Alert tone="success">{state.ok}</Alert> : null}
      {product ? <input type="hidden" name="id" value={product.id} /> : null}
      <input type="hidden" name="kind" value={kind} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre" className={isService ? "" : "sm:col-span-2"}>
          <input className={inputClass} name="name" defaultValue={product?.name ?? ""} required placeholder={isService ? "Corte de pelo" : "Café con leche"} />
        </Field>
        <Field label="Precio (€)" hint="IVA incluido">
          <input className={inputClass} name="price" defaultValue={((product?.priceCents ?? 0) / 100).toFixed(2)} inputMode="decimal" />
        </Field>
        <Field label="Categoría" hint="Agrupa el catálogo: Bebidas, Cortes…">
          <input className={inputClass} name="category" defaultValue={product?.category ?? ""} placeholder="Bebidas" />
        </Field>
        {isService ? (
          <>
            <Field label="Duración (min)">
              <input className={inputClass} type="number" min={5} step={5} name="durationMinutes" defaultValue={product?.durationMinutes ?? 30} />
            </Field>
            <Field label="Citas simultáneas" hint="Aforo de este servicio">
              <input className={inputClass} type="number" min={1} name="capacity" defaultValue={product?.capacity ?? 1} />
            </Field>
            <Field label="Señal por cita (€)" hint="0 = sin señal">
              <input className={inputClass} name="deposit" defaultValue={((product?.depositCents ?? 0) / 100).toFixed(2)} inputMode="decimal" />
            </Field>
          </>
        ) : null}
      </div>

      <Field label="Descripción">
        <textarea className={inputClass} name="description" rows={2} defaultValue={product?.description ?? ""} placeholder="Ingredientes, detalles o notas" />
      </Field>

      <Field label="Foto" hint="JPG, PNG o WebP hasta 2,5 MB. Se optimiza en el móvil.">
        <input className={inputClass} type="file" name="image" accept="image/jpeg,image/png,image/webp" />
      </Field>
      {product?.imageData ? (
        <label className="flex items-center gap-2 text-xs text-ink-500">
          <input type="checkbox" name="removeImage" /> Quitar la foto actual
        </label>
      ) : null}

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="visible" defaultChecked={product?.visible ?? true} /> Visible en el catálogo
      </label>

      <button className={btnBrand} disabled={pending}>
        {pending ? "Guardando…" : product ? "Guardar cambios" : isService ? "Añadir servicio" : "Añadir producto"}
      </button>
    </form>
  );
}

export function ProfileForm({ tenant }: { tenant: Tenant }) {
  const [state, action, pending] = useActionState(saveProfileAction, initial);
  return (
    <form action={action} className="space-y-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.ok ? <Alert tone="success">{state.ok}</Alert> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre del comercio">
          <input className={inputClass} name="name" defaultValue={tenant.name} required />
        </Field>
        <Field label="Color de marca">
          <input className={`${inputClass} h-10 p-1`} type="color" name="primaryColor" defaultValue={tenant.primaryColor} />
        </Field>
        <Field label="Dirección">
          <input className={inputClass} name="address" defaultValue={tenant.address ?? ""} />
        </Field>
        <Field label="Ciudad">
          <input className={inputClass} name="city" defaultValue={tenant.city ?? ""} />
        </Field>
        <Field label="Logo" hint="Cuadrado, mínimo 200×200 px.">
          <input className={inputClass} type="file" name="image" accept="image/jpeg,image/png,image/webp" />
        </Field>
      </div>
      <button className={btnGhost} disabled={pending}>
        {pending ? "Guardando…" : "Guardar perfil"}
      </button>
    </form>
  );
}

export function SettingsForm({ tenant }: { tenant: Tenant }) {
  const [state, action, pending] = useActionState(saveSettingsAction, initial);

  return (
    <form action={action} className="space-y-6">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.ok ? <Alert tone="success">{state.ok}</Alert> : null}

      <div>
        <h3 className="text-sm font-semibold">Horario semanal</h3>
        <p className="mb-3 text-xs text-ink-500">Dos tramos por día. Deja en blanco para cerrar.</p>
        <div className="space-y-2">
          {[1, 2, 3, 4, 5, 6, 0].map((day) => {
            const segments = tenant.hours?.[String(day)] ?? [];
            return (
              <div key={day} className="grid grid-cols-[5rem_1fr] items-center gap-2 sm:grid-cols-[5rem_1fr_1fr]">
                <span className="text-sm capitalize text-ink-700">{weekdayName(day)}</span>
                {[1, 2].map((slot) => {
                  const seg = segments[slot - 1];
                  return (
                    <div key={slot} className="flex items-center gap-1">
                      <input
                        type="time"
                        name={`d${day}_from${slot}`}
                        defaultValue={seg?.[0] ?? ""}
                        className="w-full rounded-lg border border-black/10 px-2 py-1 text-sm"
                      />
                      <span className="text-xs text-ink-300">–</span>
                      <input
                        type="time"
                        name={`d${day}_to${slot}`}
                        defaultValue={seg?.[1] ?? ""}
                        className="w-full rounded-lg border border-black/10 px-2 py-1 text-sm"
                      />
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Frecuencia de huecos (min)">
          <input className={inputClass} type="number" name="slotMinutes" min={5} max={120} step={5} defaultValue={tenant.slotMinutes} />
        </Field>
        <Field label="Duración por defecto (min)">
          <input className={inputClass} type="number" name="durationMinutes" min={5} max={480} step={5} defaultValue={tenant.durationMinutes} />
        </Field>
        <Field label="Aforo (personas o citas simultáneas)">
          <input className={inputClass} type="number" name="capacity" min={1} defaultValue={tenant.capacity} />
        </Field>
        <Field label="Máximo por reserva">
          <input className={inputClass} type="number" name="maxParty" min={1} defaultValue={tenant.maxParty} />
        </Field>
        <Field label="Antelación mínima (min)">
          <input className={inputClass} type="number" name="noticeMinutes" min={0} step={15} defaultValue={tenant.noticeMinutes} />
        </Field>
        <Field label="Antelación de encargos (horas)">
          <input className={inputClass} type="number" name="orderNoticeHours" min={0} defaultValue={tenant.orderNoticeHours} />
        </Field>
        <Field label="Prepago de reservas">
          <select className={inputClass} name="prepay" defaultValue={tenant.prepay}>
            <option value="none">Sin prepago</option>
            <option value="deposit">Señal</option>
            <option value="full">Pago completo</option>
          </select>
        </Field>
        <Field label="Importe de la señal (€)" hint="En bares se cobra por persona.">
          <input className={inputClass} name="deposit" defaultValue={(tenant.depositCents / 100).toFixed(2)} inputMode="decimal" />
        </Field>
        <Field label="WhatsApp" hint="Con prefijo, solo dígitos: 34600000000">
          <input className={inputClass} name="whatsapp" defaultValue={tenant.whatsapp ?? ""} />
        </Field>
        <Field label="Teléfono">
          <input className={inputClass} name="phone" defaultValue={tenant.phone ?? ""} />
        </Field>
      </div>

      <Field label="Condiciones para el cliente" hint="Se muestra al reservar y en el seguimiento.">
        <textarea className={inputClass} name="policyText" rows={3} defaultValue={tenant.policyText ?? ""} />
      </Field>

      <button className={btnBrand} disabled={pending}>
        {pending ? "Guardando…" : "Guardar ajustes"}
      </button>
    </form>
  );
}

export function ManualBookingForm({ services }: { services: Product[] }) {
  const [state, action, pending] = useActionState(createManualBookingAction, initial);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={action} className="space-y-3">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.ok ? <Alert tone="success">{state.ok}</Alert> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Cliente">
          <input className={inputClass} name="name" required placeholder="Nombre y apellidos" />
        </Field>
        <Field label="Teléfono">
          <input className={inputClass} name="phone" required placeholder="600 000 000" />
        </Field>
        <Field label="Fecha">
          <input className={inputClass} type="date" name="date" defaultValue={today} required />
        </Field>
        <Field label="Hora">
          <input className={inputClass} type="time" name="time" required />
        </Field>
        {services.length > 0 ? (
          <Field label="Servicio">
            <select className={inputClass} name="productId" defaultValue="">
              <option value="">Sin servicio</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.durationMinutes ?? 30} min)
                </option>
              ))}
            </select>
          </Field>
        ) : null}
        <Field label="Personas">
          <input className={inputClass} type="number" name="partySize" min={1} defaultValue={1} />
        </Field>
      </div>
      <button className={btnGhost} disabled={pending}>
        {pending ? "Añadiendo…" : "Añadir a la agenda"}
      </button>
    </form>
  );
}
