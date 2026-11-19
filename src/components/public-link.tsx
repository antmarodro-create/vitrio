"use client";

import { useState } from "react";

/**
 * El enlace por el que entra el cliente final: se copia y se pega donde sea
 * (WhatsApp, Instagram, Google) o se imprime como QR. Sin esto, el comercio
 * tiene la web hecha pero nadie sabe cómo llegar.
 */
export function PublicLinkCard({ slug, url }: { slug: string; url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border border-ink-950/15 bg-white/70 px-5 py-4">
      <div className="min-w-0 flex-1">
        <p className="eyebrow-sm text-ink-300">Tu enlace para clientes</p>
        <p className="mt-1 truncate font-mono text-[13px] text-ink-900">{url.replace(/^https?:\/\//, "")}</p>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={copy}
          className="border border-ink-950/20 px-3 py-2 text-[11px] font-semibold tracking-wide hover:border-ink-950"
        >
          {copied ? "Copiado ✓" : "Copiar enlace"}
        </button>
        <a
          href={`/c/${slug}`}
          target="_blank"
          rel="noreferrer"
          className="bg-ink-950 px-3 py-2 text-[11px] font-semibold tracking-wide text-ivory hover:bg-ink-900"
        >
          Abrir
        </a>
        <a
          href="/app/qr"
          className="border border-ink-950/20 px-3 py-2 text-[11px] font-semibold tracking-wide hover:border-ink-950"
        >
          QR
        </a>
      </div>
    </div>
  );
}
