"use client";

import * as React from "react";
import { Controller, FormProvider, useFormContext, type ControllerProps, type FieldPath, type FieldValues } from "react-hook-form";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

const Form = FormProvider;

type FieldCtx = { name: string; id: string };
const FormFieldContext = React.createContext<FieldCtx | null>(null);

function FormField<TFieldValues extends FieldValues = FieldValues, TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>, TTransformed = TFieldValues>(props: ControllerProps<TFieldValues, TName, TTransformed>) {
  const id = React.useId();
  return (
    <FormFieldContext.Provider value={{ name: props.name, id }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  );
}

function useFormField() {
  const ctx = React.useContext(FormFieldContext);
  const { getFieldState, formState } = useFormContext();
  if (!ctx) throw new Error("useFormField tem de estar dentro de <FormField>");
  const state = getFieldState(ctx.name, formState);
  return { ...ctx, ...state, controlId: `${ctx.id}-control`, messageId: `${ctx.id}-message` };
}

function FormItem({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="form-item" className={cn("grid gap-1.5", className)} {...props} />;
}
function FormLabel({ className, ...props }: React.ComponentProps<typeof Label>) {
  const { error, controlId } = useFormField();
  return <Label htmlFor={controlId} data-error={!!error} className={cn("data-[error=true]:text-destructive", className)} {...props} />;
}
/** Liga o controlo (Input, Select...) ao rótulo e à mensagem de erro. */
function FormControl({ children }: { children: React.ReactElement<Record<string, unknown>> }) {
  const { error, controlId, messageId } = useFormField();
  return React.cloneElement(children, { id: controlId, "aria-invalid": !!error, "aria-describedby": error ? messageId : undefined });
}
function FormDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("text-xs text-muted-foreground", className)} {...props} />;
}
function FormMessage({ className, ...props }: React.ComponentProps<"p">) {
  const { error, messageId } = useFormField();
  const body = error ? String(error.message ?? "") : props.children;
  if (!body) return null;
  return <p id={messageId} role={error ? "alert" : undefined} className={cn("text-xs text-destructive", className)} {...props}>{body}</p>;
}

export { Form, FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage, useFormField };
