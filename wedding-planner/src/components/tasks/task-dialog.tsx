"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { FormError, SelectField, TextField, TextareaField } from "@/components/fields";
import { useApi, useRun } from "@/lib/data/actions";
import { useWedding } from "@/lib/data/queries";
import type { Task } from "@/lib/db-types";
import { TASK_CATEGORIES, entries, taskPriorityLabel, taskStatusLabel } from "@/lib/labels";
import { taskSchema } from "@/lib/validation";

type In = z.input<typeof taskSchema>;
type Out = z.output<typeof taskSchema>;

export function TaskDialog({ open, onOpenChange, task, defaults }: { open: boolean; onOpenChange: (o: boolean) => void; task?: Task | null; defaults?: Partial<In> }) {
  const wedding = useWedding();
  const api = useApi();
  const { run, pending } = useRun();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<In, unknown, Out>({ resolver: zodResolver(taskSchema) });

  useEffect(() => {
    if (!open) return;
    setError(null);
    form.reset(task
      ? { title: task.title, description: task.description ?? "", category: task.category ?? "", assignee: task.assignee, assignee_other: task.assignee_other ?? "", due_date: task.due_date ?? "", priority: task.priority, status: task.status }
      : { title: "", description: "", category: "", assignee: "both", assignee_other: "", due_date: "", priority: "media", status: "por_iniciar", ...defaults });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, task?.id]);

  const assignee = form.watch("assignee");
  const onSubmit = async (v: Out) => {
    setError(null);
    const payload = { ...v, assignee_other: v.assignee === "other" ? v.assignee_other : null };
    const ok = await run(() => api.upsert("tasks", task?.id ?? null, payload).then(() => true), { success: task ? "Tarefa atualizada." : "Tarefa criada.", invalidate: ["tasks"] });
    if (ok) onOpenChange(false); else setError("Não foi possível guardar a tarefa.");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>{task ? "Editar tarefa" : "Nova tarefa"}</DialogTitle><DialogDescription>Organize o que falta fazer, quem trata e até quando.</DialogDescription></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-3 sm:grid-cols-2" noValidate>
            <TextField control={form.control} name="title" label="Título *" className="sm:col-span-2" />
            <TextareaField control={form.control} name="description" label="Descrição" className="sm:col-span-2" />
            <TextField control={form.control} name="category" label="Categoria" list="task-categories" placeholder="Ex.: Fornecedores" />
            <datalist id="task-categories">{TASK_CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
            <TextField control={form.control} name="due_date" label="Data limite" type="date" />
            <SelectField control={form.control} name="assignee" label="Responsável" options={[{ value: "partner1", label: wedding.partner1_name }, { value: "partner2", label: wedding.partner2_name }, { value: "both", label: "Ambos" }, { value: "other", label: "Outra pessoa" }]} />
            {assignee === "other" ? <TextField control={form.control} name="assignee_other" label="Nome do responsável *" /> : <div className="hidden sm:block" />}
            <SelectField control={form.control} name="priority" label="Prioridade" options={entries(taskPriorityLabel)} />
            <SelectField control={form.control} name="status" label="Estado" options={entries(taskStatusLabel)} />
            <div className="sm:col-span-2"><FormError message={error} /></div>
            <DialogFooter className="sm:col-span-2"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit" disabled={pending}>{pending && <Loader2 className="animate-spin" />}{task ? "Guardar" : "Criar tarefa"}</Button></DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
