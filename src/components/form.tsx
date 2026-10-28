"use client";

import { createContext, useActionState, useContext } from "react";
import type { FormState } from "@/app/actions";

const ErrorsContext = createContext<Record<string, string>>({});

export function Field({
  label, name, type = "text", hint, autoComplete, required = true,
}: {
  label: string; name: string; type?: string; hint?: string;
  autoComplete?: string; required?: boolean;
}) {
  const error = useContext(ErrorsContext)[name];
  const id = `f-${name}`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      <input
        id={id} name={name} type={type} required={required} autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
        className="min-h-11 rounded-md border border-[var(--border)] bg-transparent px-3 text-base"
      />
      {hint && !error && <p id={`${id}-hint`} className="text-xs text-[var(--muted)]">{hint}</p>}
      {error && <p id={`${id}-err`} role="alert" className="text-sm text-[var(--danger)]">{error}</p>}
    </div>
  );
}

/** Mostra o erro de um campo que não é um <Field> (ex.: caixa de aceitação). */
export function FieldError({ name }: { name: string }) {
  const error = useContext(ErrorsContext)[name];
  return error ? <p role="alert" className="text-sm text-[var(--danger)]">{error}</p> : null;
}

export function AuthForm({
  action, submitLabel, children, hidden,
}: {
  action: (s: FormState, fd: FormData) => Promise<FormState>;
  submitLabel: string;
  children: React.ReactNode;
  hidden?: Record<string, string>;
}) {
  const [state, formAction, pending] = useActionState(action, {} as FormState);
  if (state.ok) {
    return <p role="status" className="rounded-md border border-[var(--border)] p-4 text-[var(--ok)]">{state.message}</p>;
  }
  return (
    <ErrorsContext.Provider value={state.errors ?? {}}>
      <form action={formAction} className="flex flex-col gap-4" noValidate>
        {hidden && Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        {children}
        {state.message && <p role="alert" className="text-sm text-[var(--danger)]">{state.message}</p>}
        <button
          type="submit" disabled={pending}
          className="min-h-11 rounded-md bg-[var(--brand)] px-4 font-medium text-[var(--brand-fg)] disabled:opacity-60"
        >
          {submitLabel}
        </button>
      </form>
    </ErrorsContext.Provider>
  );
}
