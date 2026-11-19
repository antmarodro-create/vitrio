import { requireUser } from "@/lib/auth";
import { Alert, Card, CardBody } from "@/components/ui";
import { ChangePasswordForm } from "@/components/auth-forms";

export const metadata = { title: "Cambiar contraseña" };

export default async function ChangePasswordPage() {
  const session = await requireUser();

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Cambia tu contraseña</h1>
      <p className="mt-1 mb-5 text-sm text-ink-500">{session.user.email}</p>
      {session.user.mustChangePassword ? (
        <div className="mb-4">
          <Alert tone="warn">
            Es tu primera vez: la contraseña temporal debe cambiarse antes de continuar.
          </Alert>
        </div>
      ) : null}
      <Card>
        <CardBody>
          <ChangePasswordForm />
        </CardBody>
      </Card>
    </main>
  );
}
