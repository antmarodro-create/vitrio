import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { products, tenants } from "@/db/schema";

/**
 * Sirve las imagenes guardadas como data URL (fotos de producto y logos).
 * Con mucho volumen conviene moverlas a un bucket de objetos.
 */
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const type = new URL(request.url).searchParams.get("t");

  let dataUrl: string | null = null;
  if (type === "logo") {
    const rows = await db.select({ logoData: tenants.logoData }).from(tenants).where(eq(tenants.id, id)).limit(1);
    dataUrl = rows[0]?.logoData ?? null;
  } else if (type === "cover") {
    const rows = await db.select({ coverData: tenants.coverData }).from(tenants).where(eq(tenants.id, id)).limit(1);
    dataUrl = rows[0]?.coverData ?? null;
  } else {
    const rows = await db.select({ imageData: products.imageData }).from(products).where(eq(products.id, id)).limit(1);
    dataUrl = rows[0]?.imageData ?? null;
    if (!dataUrl) {
      const logo = await db.select({ logoData: tenants.logoData }).from(tenants).where(eq(tenants.id, id)).limit(1);
      dataUrl = logo[0]?.logoData ?? null;
    }
  }

  if (!dataUrl) return new Response("Not found", { status: 404 });

  const match = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl);
  if (!match) return new Response("Not found", { status: 404 });

  const body = Buffer.from(match[2], "base64");
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": match[1],
      "Content-Length": String(body.length),
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
