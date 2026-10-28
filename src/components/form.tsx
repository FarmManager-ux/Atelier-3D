"use client";

import { createContext, useActionState, useContext } from "react";
import type { FormState } from "@/app/actions";

const ErrorsContext = createContext<Record<string, string>>({});

export function Field({
  label, name, type = "text", hint, autoComplete, required = true, defaultValue, inputMode, maxLength,
}: {
  label: string; name: string; type?: string; hint?: string;
  autoComplete?: string; required?: boolean; defaultValue?: string | null;
  inputMode?: "text" | "tel" | "email" | "numeric" | "url"; maxLength?: number;
}) {
  const error = useContext(ErrorsContext)[name];
  const id = `f-${name}`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      <input
        id={id} name={name} type={type} required={required} autoComplete={autoComplete}
        defaultValue={defaultValue ?? undefined} inputMode={inputMode} maxLength={maxLength}
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

export function SelectField({
  label, name, options, defaultValue,
}: { label: string; name: string; options: { value: string; label: string }[]; defaultValue?: string }) {
  const error = useContext(ErrorsContext)[name];
  const id = `f-${name}`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      <select
        id={id} name={name} defaultValue={defaultValue} aria-invalid={error ? true : undefined}
        className="min-h-11 rounded-md border border-[var(--border)] bg-transparent px-3 text-base"
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {error && <p role="alert" className="text-sm text-[var(--danger)]">{error}</p>}
    </div>
  );
}

export function CheckField({ label, name }: { label: string; name: string }) {
  return (
    <label className="flex min-h-11 items-center gap-2 text-sm">
      <input type="checkbox" name={name} className="size-5" /> <span>{label}</span>
    </label>
  );
}

type ActionResult = { errors?: Record<string, string>; message?: string; ok?: boolean; link?: string };

/** Formulário de edição: mantém-se visível após guardar e mostra o resultado. */
export function ActionForm({
  action, submitLabel, children, hidden, resetOnSuccess = false,
}: {
  action: (s: ActionResult, fd: FormData) => Promise<ActionResult>;
  submitLabel: string; children: React.ReactNode; hidden?: Record<string, string>; resetOnSuccess?: boolean;
}) {
  const [state, formAction, pending] = useActionState(async (s: ActionResult, fd: FormData) => action(s, fd), {} as ActionResult);
  return (
    <ErrorsContext.Provider value={state.errors ?? {}}>
      <form
        key={resetOnSuccess && state.ok ? "done" : "form"}
        action={formAction} className="flex flex-col gap-4" noValidate
      >
        {hidden && Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        {children}
        {state.message && (
          <p role={state.ok ? "status" : "alert"} className={`text-sm ${state.ok ? "text-[var(--ok)]" : "text-[var(--danger)]"}`}>
            {state.message}
          </p>
        )}
        {state.link && (
          <input readOnly aria-label="Ligação do convite" value={typeof window !== "undefined" ? `${window.location.origin}${state.link}` : state.link}
            onFocus={(e) => e.currentTarget.select()}
            className="min-h-11 rounded-md border border-[var(--border)] bg-transparent px-3 font-mono text-xs" />
        )}
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
