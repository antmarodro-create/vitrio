import { redirect } from "next/navigation";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { Card, CardBody } from "@/components/ui";
import { LoginForm } from "@/components/auth-forms";

export const metadata = { title: "Acceso" };

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect(session.user.role === "superadmin" ? "/admin" : "/app");

  const rows = await db.select({ n: sql<number>`count(*)::int` }).from(users);
  if ((rows[0]?.n ?? 0) === 0) redirect("/setup");

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
      <div className="mb-6 flex items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-ink-950 text-sm font-bold text-white">V</span>
        <div>
          <p className="font-semibold leading-tight">Vitrio</p>
          <p className="text-xs text-ink-500">Panel del comercio y administración</p>
        </div>
      </div>
      <Card>
        <CardBody>
          <LoginForm />
        </CardBody>
      </Card>
    </main>
  );
}
