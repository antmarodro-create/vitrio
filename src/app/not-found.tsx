import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center px-5 text-center">
      <p className="text-xs font-semibold uppercase tracking-widest text-ink-300">404</p>
      <h1 className="mt-2 text-xl font-semibold">No encontramos esta página</h1>
      <p className="mt-1 text-sm text-ink-500">
        Puede que el catálogo haya cambiado de dirección o que la cuenta esté pausada.
      </p>
      <Link href="/" className="mt-5 rounded-xl bg-ink-950 px-4 py-2 text-sm font-semibold text-white">
        Volver al inicio
      </Link>
    </main>
  );
}
