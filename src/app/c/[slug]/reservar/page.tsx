import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicTenant } from "@/lib/public";
import { bookingDepositCents, bookingLabel, getDayAvailability, nextAvailableDays, usesPartySize } from "@/lib/booking";
import { planHas } from "@/lib/plans";
import { tenantCanCharge } from "@/lib/stripe";
import { formatIsoDateShort, todayInTz } from "@/lib/time";
import { formatEUR } from "@/lib/money";
import { Alert, Empty, Eyebrow } from "@/components/ui";
import { BookForm } from "../book-form";

export const dynamic = "force-dynamic";

const WEEKDAY = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

function parts(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return { day: String(d).padStart(2, "0"), month: new Intl.DateTimeFormat("es-ES", { month: "short" }).format(new Date(Date.UTC(y, m - 1, d))), weekday: WEEKDAY[weekday] };
}

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

  const { slots, reason } = await getDayAvailability({ tenant, isoDate, productId, partySize, plan });

  const selected = sp.hora ? slots.find((s) => s.time === sp.hora && s.available) : null;
  const canCharge = planHas(plan, "payments") && tenantCanCharge(tenant);
  const deposit = canCharge ? bookingDepositCents(tenant, service, partySize) : 0;
  const label = bookingLabel(tenant);
  const free = slots.filter((s) => s.available).length;

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
    <div className="space-y-9">
      <div>
        <Eyebrow>{label}</Eyebrow>
        <h1 className="serif mt-3 text-3xl leading-tight sm:text-4xl">
          {selected ? `Confirmar a las ${selected.time}` : "Elige día y hora"}
        </h1>
        <p className="mt-2 text-sm text-ink-500">
          {service
            ? `${service.name} · ${service.durationMinutes ?? tenant.durationMinutes} min`
            : partyMode
              ? `Mesas de hasta ${tenant.maxParty} personas`
              : `${tenant.durationMinutes} min por cita`}
          {free > 0 ? ` · ${free} huecos libres` : ""}
        </p>
      </div>

      {services.length > 0 ? (
        <section>
          <p className="eyebrow-sm text-ink-300">Servicio</p>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
            {partyMode ? (
              <Link
                href={query({ servicio: "", hora: undefined })}
                className={`pb-0.5 text-[13px] ${!productId ? "border-b border-ink-950 text-ink-950" : "text-ink-500 hover:text-ink-900"}`}
              >
                Solo mesa
              </Link>
            ) : null}
            {services.map((s) => (
              <Link
                key={s.id}
                href={query({ servicio: s.id, hora: undefined })}
                className={`pb-0.5 text-[13px] ${
                  s.id === productId ? "border-b border-ink-950 text-ink-950" : "text-ink-500 hover:text-ink-900"
                }`}
              >
                {s.name} · {formatEUR(s.priceCents)}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {partyMode ? (
        <section>
          <p className="eyebrow-sm text-ink-300">Comensales</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {Array.from({ length: Math.min(tenant.maxParty, 12) }, (_, i) => i + 1).map((n) => (
              <Link
                key={n}
                href={query({ personas: String(n), hora: undefined })}
                className={`grid h-10 w-10 place-items-center border text-sm tabular-nums ${
                  n === partySize
                    ? "border-ink-950 bg-ink-950 text-ivory"
                    : "border-ink-950/15 text-ink-700 hover:border-ink-950/40"
                }`}
              >
                {n}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <p className="eyebrow-sm text-ink-300">Día</p>
        <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1">
          {days.map((day) => {
            const p = parts(day);
            const active = day === isoDate;
            return (
              <Link
                key={day}
                href={query({ fecha: day, hora: undefined })}
                className={`w-[62px] flex-none border py-2.5 text-center transition ${
                  active ? "border-ink-950 bg-ink-950 text-ivory" : "border-ink-950/15 hover:border-ink-950/40"
                }`}
              >
                <span className="eyebrow-sm block opacity-60">{p.weekday}</span>
                <span className="serif mt-0.5 block text-xl leading-none">{p.day}</span>
                <span className="block text-[10px] uppercase tracking-widest opacity-60">{p.month}</span>
              </Link>
            );
          })}
        </div>
      </section>

      <section>
        <div className="flex items-baseline justify-between">
          <p className="eyebrow-sm text-ink-300">Hora</p>
          <p className="text-[111x] text-ink-300" style={{ fontSize: 11 }}>
            {formatIsoDateShort(isoDate, tenant.timezone)}
          </p>
        </div>
        {slots.length === 0 ? (
          <div className="mt-3">
            <Alert tone="warn">{reason ?? "No quedan huecos ese día. Prueba otro."}</Alert>
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
            {slots.map((slot) => (
              <Link
                key={slot.startIso}
                href={slot.available ? query({ hora: slot.time }) : query({ fecha: isoDate, hora: undefined })}
                aria-disabled={!slot.available}
                className={`border py-2.5 text-center text-sm tabular-nums transition ${
                  selected?.time === slot.time
                    ? "border-brand-600 bg-brand-600 text-white"
                    : slot.available
                      ? "border-ink-950/15 hover:border-ink-950/40"
                      : "cursor-not-allowed border-transparent bg-ink-950/[0.03] text-ink-300 line-through"
                }`}
              >
                {slot.time}
              </Link>
            ))}
          </div>
        )}
      </section>

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
        <p className="border-t border-ink-950/10 pt-6 text-center text-sm text-ink-500">
          {slots.length ? "Elige una hora para continuar." : ""}
        </p>
      )}
    </div>
  );
}
