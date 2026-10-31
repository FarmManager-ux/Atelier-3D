"use client";

import * as React from "react";
import type { Control, FieldPath, FieldValues } from "react-hook-form";
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input, Textarea } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

 
type AnyControl<T extends FieldValues> = Control<T, any, any>;
type Base<T extends FieldValues> = { control: AnyControl<T>; name: FieldPath<T>; label: string; description?: string; className?: string };

export function TextField<T extends FieldValues>({ control, name, label, description, className, ...input }: Base<T> & Omit<React.ComponentProps<"input">, "name" | "defaultValue" | "value">) {
  return (
    <FormField control={control} name={name} render={({ field }) => (
      <FormItem className={className}>
        <FormLabel>{label}</FormLabel>
        <FormControl><Input {...input} {...field} value={(field.value as string) ?? ""} /></FormControl>
        {description && <FormDescription>{description}</FormDescription>}
        <FormMessage />
      </FormItem>
    )} />
  );
}

export function TextareaField<T extends FieldValues>({ control, name, label, description, className, ...ta }: Base<T> & Omit<React.ComponentProps<"textarea">, "name" | "defaultValue" | "value">) {
  return (
    <FormField control={control} name={name} render={({ field }) => (
      <FormItem className={className}>
        <FormLabel>{label}</FormLabel>
        <FormControl><Textarea {...ta} {...field} value={(field.value as string) ?? ""} /></FormControl>
        {description && <FormDescription>{description}</FormDescription>}
        <FormMessage />
      </FormItem>
    )} />
  );
}

export function SelectField<T extends FieldValues>({ control, name, label, description, className, options, placeholder }: Base<T> & { options: { value: string; label: string }[]; placeholder?: string }) {
  return (
    <FormField control={control} name={name} render={({ field }) => (
      <FormItem className={className}>
        <FormLabel>{label}</FormLabel>
        <Select value={(field.value as string) || undefined} onValueChange={field.onChange}>
          <FormControl><SelectTrigger className={cn("w-full")}><SelectValue placeholder={placeholder ?? "Escolher…"} /></SelectTrigger></FormControl>
          <SelectContent>{options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
        </Select>
        {description && <FormDescription>{description}</FormDescription>}
        <FormMessage />
      </FormItem>
    )} />
  );
}

/** Mostra erros gerais de um formulário (ex.: resposta do servidor). */
export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return <p role="alert" className="rounded-md border border-[#e2b8b1] bg-[#fbf1ef] px-3 py-2 text-sm text-[#8a3b32]">{message}</p>;
}
