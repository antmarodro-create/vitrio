export const metadata = { title: "Sin conexión" };

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center px-5 text-center">
      <p className="text-lg font-semibold">Sin conexión</p>
      <p className="mt-1 text-sm text-ink-500">
        No hemos podido cargar Vitrio. Comprueba tu conexión y vuelve a intentarlo.
      </p>
    </main>
  );
}
