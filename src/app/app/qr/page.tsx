import Link from "next/link";
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { events } from "@/db/schema";
import { requireTenant } from "@/lib/auth";
import { Card, CardBody, SectionTitle, Stat, btnGhost } from "@/components/ui";
import { addDays } from "@/lib/time";
import { PrintButton } from "@/components/print-button";
import { config } from "@/lib/config";

export const metadata = { title: "QR" };
export const dynamic = "force-dynamic";

export default async function QrPage() {
  const { tenant } = await requireTenant();

  const [scans30, scans7] = await Promise.all([
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(events)
      .where(and(eq(events.tenantId, tenant.id), eq(events.type, "qr_scan"), gte(events.createdAt, addDays(new Date(), -30)))),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(events)
      .where(and(eq(events.tenantId, tenant.id), eq(events.type, "qr_scan"), gte(events.createdAt, addDays(new Date(), -7)))),
  ]);

  const publicLink = `${config.appUrl}/c/${tenant.slug}`;

  return (
    <div className="space-y-6">
      <SectionTitle
        title="QR y cartel"
        hint="El QR cuenta el escaneo y lleva al catálogo. Imprímelo en tamaño folio para mesas o escaparate."
        action={
          <a href={`/api/qr/${tenant.slug}?size=1200`} download={`vitrio-${tenant.slug}.png`} className={btnGhost}>
            Descargar PNG
          </a>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Escaneos (7 d)" value={scans7[0]?.n ?? 0} />
        <Stat label="Escaneos (30 d)" value={scans30[0]?.n ?? 0} />
        <Stat label="Enlace" value={<span className="text-sm font-normal break-all">{publicLink}</span>} />
      </div>

      <Card className="print:border-0 print:shadow-none">
        <CardBody className="flex flex-col items-center gap-4 py-10 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/qr/${tenant.slug}?size=600`}
            alt={`QR de ${tenant.name}`}
            className="h-64 w-64 rounded-2xl border border-black/5 bg-white p-2"
          />
          <div>
            <p className="text-xl font-semibold">{tenant.name}</p>
            <p className="text-sm text-ink-500">
              {tenant.address ?? ""} {tenant.city ? `· ${tenant.city}` : ""}
            </p>
          </div>
          <p className="max-w-sm text-sm text-ink-700">
            Escanea el QR para ver la carta, reservar o hacer tu encargo.
          </p>
          <p className="text-[11px] uppercase tracking-widest text-ink-300">Funciona con Vitrio</p>
        </CardBody>
      </Card>

      <div className="no-print flex flex-wrap gap-2">
        <PrintButton />
        <Link href={`/q/${tenant.slug}`} target="_blank" className={btnGhost}>
          Probar el enlace
        </Link>
        <Link href={`/c/${tenant.slug}`} target="_blank" className={btnGhost}>
          Ver catálogo
        </Link>
      </div>
    </div>
  );
}
