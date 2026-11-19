import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicTenant } from "@/lib/public";
import { bookingDepositCents, bookingLabel, getDayAvailability, nextAvailableDays, usesPartySize } from "@/lib/booking";
import { planHas } from "@/lib/plans";
import { tenantCanCharge } from "@/lib/stripe";
import { formatIsoDateShort, formatTime, todayInTz } from "@/lib/time";
import { formatEUR } from "@/lib/money";
import { Alert, Empty } from "@/components/ui";
import { BookForm } from "../book-form";

export const dynamic = "force-dynamic";

export default async function BookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ fecha?: string; hora?: string; personas?: string; servicio?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const data = await getPublicTenant(slug);
  if (!data) notFound();
  const { tenant, plan, services } = data;

  if (!tenant.bookingsEnabled || !planHas(plan, "bookings")) {
    return <Empty title="Reservas no disponibles" hint="Este comercio no acepta reservas online ahora mismo." />;
  }

  const partyMode = usesPartySize(tenant);
  const partySize = Math.min(tenant.maxParty, Math.max(1, Number(sp.personas ?? (partyMode ? 2 : 1))));
  // En bares la reserva por defecto es de mesa (sin servicio). En servicios/citas,
  // el primer servicio es el punto de partida natural.
  const explicitService = sp.servicio === "" ? null : sp.servicio;
  const productId =
    explicitService && services.some((s) => s.id === explicitService)
      ? explicitService
      : explicitService === null
        ? null
        : partyMode
          ? null
          : services[0]?.id ?? null;
  const service = services.find((s) => s.id === productId) ?? null;

  const days = await nextAvailableDays(tenant, 10);
  const today = todayInTz(tenant.timezone);
  const isoDate = sp.fecha && days.includes(sp.fecha) ? sp.fecha : days[0] ?? today;

  const { slots, reason } = await getDayAvailability({
    tenant,
    isoDate,
    productId,
    partySize,
    plan,
  });

  const selected = sp.hora ? slots.find((s) => s.time === sp.hora && s.available) : null;
  const canCharge = planHas(plan, "payments") && tenantCanCharge(tenant);
  const deposit = canCharge ? bookingDepositCents(tenant, service, partySize) : 0;
  const label = bookingLabel(tenant);

  const query = (extra: Record<string, string | undefined>) => {
    const qs = new URLSearchParams();
    if (isoDate) qs.set("fecha", isoDate);
    if (productId) qs.set("servicio", productId);
    if (partyMode) qs.set("personas", String(partySize));
    for (const [k, v] of Object.entries(extra)) {
      if (v === undefined) qs.delete(k);
      else qs.set(k, v);
    }
    return `/c/${slug}/reservar?${qs.toString()}`;
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{label}</h1>
        <p className="text-sm text-ink-500">
          {service
            ? `${service.name} · ${service.durationMinutes ?? tenant.durationMinutes} min`
            : partyMode
              ? `Mesas de hasta ${tenant.maxParty} personas`
              : `${tenant.durationMinutes} min por cita`}
        </p>
      </div>

      {services.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Servicio</p>
          <div className="flex flex-wrap gap-1.5">
            {partyMode ? (
              <Link
                href={query({ servicio: "", hora: undefined })}
                className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                  !productId ? "bg-ink-950 text-white" : "bg-white text-ink-700 hover:bg-black/5"
                }`}
              >
                Solo mesa
              </Link>
            ) : null}
            {services.map((s) => (
              <Link
                key={s.id}
                href={query({ servicio: s.id, hora: undefined })}
                className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                  s.id === productId ? "bg-ink-950 text-white" : "bg-white text-ink-700 hover:bg-black/5"
                }`}
              >
                {s.name} · {formatEUR(s.priceCents)}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {partyMode ? (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Personas</p>
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: Math.min(tenant.maxParty, 12) }, (_, i) => i + 1).map((n) => (
              <Link
                key={n}
                href={query({ personas: String(n), hora: undefined })}
                className={`h-9 w-9 rounded-full text-center text-sm font-semibold leading-9 ${
                  n === partySize ? "bg-ink-950 text-white" : "bg-white text-ink-700 hover:bg-black/5"
                }`}
              >
                {n}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <div className="space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Día</p>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {days.map((day) => (
            <Link
              key={day}
              href={query({ fecha: day, hora: undefined })}
              className={`whitespace-nowrap rounded-xl px-3 py-2 text-xs font-medium ${
                day === isoDate ? "bg-ink-950 text-white" : "bg-white text-ink-700 hover:bg-black/5"
              }`}
            >
              {formatIsoDateShort(day, tenant.timezone)}
            </Link>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Hora</p>
        {slots.length === 0 ? (
          <Alert tone="warn">{reason ?? "No quedan huecos ese día. Prueba otro."}</Alert>
        ) : (
          <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
            {slots.map((slot) => (
              <Link
                key={slot.startIso}
                href={slot.available ? query({ hora: slot.time }) : query({ fecha: isoDate, hora: undefined })}
                aria-disabled={!slot.available}
                className={`rounded-xl py-2 text-center text-sm font-medium ${
                  selected?.time === slot.time
                    ? "bg-brand-600 text-white"
                    : slot.available
                      ? "bg-white text-ink-900 hover:bg-brand-50"
                      : "cursor-not-allowed bg-black/[0.03] text-ink-300 line-through"
                }`}
              >
                {slot.time}
              </Link>
            ))}
          </div>
        )}
      </div>

      {selected ? (
        <BookForm
          slug={slug}
          startsAt={selected.startIso}
          productId={productId}
          partySize={partySize}
          label={label}
          playingWithParty={partyMode}
          policy={tenant.policyText}
          price={
            deposit > 0
              ? `Señal de ${formatEUR(deposit)} al confirmar`
              : service
                ? `${formatEUR(service.priceCents)} · se paga en el local`
                : "Sin prepago"
          }
        />
      ) : (
        <p className="text-center text-sm text-ink-500">
          {slots.length ? `Elige una hora para el ${formatTime(new Date(slots[0].startIso), tenant.timezone)} en adelante.` : ""}
        </p>
      )}
    </div>
  );
}
