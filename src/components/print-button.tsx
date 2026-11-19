"use client";

import { btnGhost } from "@/components/ui";

export function PrintButton({ label = "Imprimir cartel" }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className={btnGhost}>
      {label}
    </button>
  );
}
