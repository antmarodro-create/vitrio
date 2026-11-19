"use client";

import { useActionState } from "react";
import Link from "next/link";
import { changePasswordAction, loginAction, setupAction, type FormState } from "@/app/actions/auth";
import { Alert, Field, btnPrimary, inputClass } from "@/components/ui";

const initial: FormState = { error: null };

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initial);
  return (
    <form action={action} className="space-y-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      <Field label="Email">
        <input
          className={inputClass}
          type="email"
          name="email"
          autoComplete="username"
          required
          autoFocus
          placeholder="tu@comercio.com"
        />
      </Field>
      <Field label="Contraseña">
        <input className={inputClass} type="password" name="password" autoComplete="current-password" required />
      </Field>
      <button className={`${btnPrimary} w-full`} disabled={pending}>
        {pending ? "Entrando…" : "Entrar"}
      </button>
      <p className="text-center text-xs text-ink-500">
        ¿Problemas para entrar? Escríbenos y restablecemos tu contraseña.
      </p>
    </form>
  );
}

export function SetupForm({ defaultEmail }: { defaultEmail: string }) {
  const [state, action, pending] = useActionState(setupAction, initial);
  return (
    <form action={action} className="space-y-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      <Field label="Email del superadmin">
        <input className={inputClass} type="email" name="email" defaultValue={defaultEmail} required />
      </Field>
      <Field label="Contraseña" hint="Mínimo 10 caracteres. Guárdala en un gestor de contraseñas.">
        <input className={inputClass} type="password" name="password" minLength={10} required />
      </Field>
      <Field label="Repite la contraseña">
        <input className={inputClass} type="password" name="repeat" minLength={10} required />
      </Field>
      <button className={`${btnPrimary} w-full`} disabled={pending}>
        {pending ? "Creando…" : "Crear cuenta de administración"}
      </button>
    </form>
  );
}

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changePasswordAction, initial);
  return (
    <form action={action} className="space-y-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      <Field label="Contraseña actual">
        <input className={inputClass} type="password" name="current" autoComplete="current-password" required />
      </Field>
      <Field label="Nueva contraseña" hint="Mínimo 10 caracteres.">
        <input className={inputClass} type="password" name="next" autoComplete="new-password" minLength={10} required />
      </Field>
      <Field label="Repite la nueva contraseña">
        <input className={inputClass} type="password" name="repeat" autoComplete="new-password" minLength={10} required />
      </Field>
      <button className={`${btnPrimary} w-full`} disabled={pending}>
        {pending ? "Guardando…" : "Cambiar contraseña"}
      </button>
      <p className="text-center text-xs text-ink-500">
        <Link href="/app" className="underline">
          Volver
        </Link>
      </p>
    </form>
  );
}
