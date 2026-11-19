import QRCode from "qrcode";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { tenants } from "@/db/schema";
import { publicUrl } from "@/lib/config";

export async function GET(request: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const rows = await db.select({ slug: tenants.slug, status: tenants.status }).from(tenants).where(eq(tenants.slug, slug)).limit(1);
  const tenant = rows[0];
  if (!tenant || tenant.status === "deleted") return new Response("Not found", { status: 404 });

  const size = Math.min(1200, Math.max(200, Number(new URL(request.url).searchParams.get("size") ?? 600)));
  // El QR apunta a /q/[slug] para poder contar escaneos y redirigir al catálogo.
  const target = publicUrl(`/q/${tenant.slug}`);
  const png = await QRCode.toBuffer(target, {
    type: "png",
    width: size,
    margin: 2,
    errorCorrectionLevel: "M",
    color: { dark: "#0a0f12", light: "#ffffff" },
  });

  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
