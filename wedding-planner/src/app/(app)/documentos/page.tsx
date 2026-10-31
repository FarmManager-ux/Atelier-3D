"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Download, Eye, FileSpreadsheet, FileText, FileType2, FolderOpen, ImageIcon, Loader2, MoreHorizontal, Pencil, Search, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { FormError, SelectField, TextField, TextareaField } from "@/components/fields";
import { useConfirm } from "@/components/confirm";
import { BUCKET, UploadDialog } from "@/components/documents/upload-dialog";
import { formatBytes, isImage } from "@/components/documents/files";
import { EmptyState, ErrorState, PageHeader, SkeletonCards } from "@/components/page";
import { getSupabase } from "@/lib/supabase/client";
import { useApi, useRun } from "@/lib/data/actions";
import { useDocuments, useVendors, EMPTY } from "@/lib/data/queries";
import { normalizeText } from "@/lib/domain/guests";
import type { DocumentCategory, DocumentRow } from "@/lib/db-types";
import { documentCategoryLabel, entries } from "@/lib/labels";
import { documentSchema } from "@/lib/validation";

type In = z.input<typeof documentSchema>;
type Out = z.output<typeof documentSchema>;

function fileIcon(d: DocumentRow) {
  if ((d.mime_type ?? "").startsWith("image/")) return ImageIcon;
  if (/sheet|excel/.test(d.mime_type ?? "") || /\.xlsx?$/i.test(d.storage_path)) return FileSpreadsheet;
  if (/word/.test(d.mime_type ?? "") || /\.docx?$/i.test(d.storage_path)) return FileType2;
  return FileText;
}

/** Abre ou descarrega com um URL assinado de curta duração (o ficheiro nunca é público). */
async function openSigned(d: DocumentRow, download = false) {
  const win = download ? null : window.open("", "_blank");
  const { data, error } = await getSupabase().storage.from(BUCKET).createSignedUrl(d.storage_path, 120, download ? { download: `${d.name}${/\.[A-Za-z0-9]+$/.exec(d.storage_path)?.[0] ?? ""}` } : undefined);
  if (error || !data) { win?.close(); toast.error("Não foi possível abrir o documento."); return; }
  if (download) { const a = document.createElement("a"); a.href = data.signedUrl; a.rel = "noopener"; document.body.appendChild(a); a.click(); a.remove(); }
  else if (win) { win.opener = null; win.location.href = data.signedUrl; } else window.location.href = data.signedUrl;
}

function EditDialog({ doc, onClose }: { doc: DocumentRow; onClose: () => void }) {
  const vendors = useVendors().data ?? EMPTY;
  const api = useApi();
  const { run, pending } = useRun();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<In, unknown, Out>({ resolver: zodResolver(documentSchema), defaultValues: { name: doc.name, category: doc.category, vendor_id: doc.vendor_id ?? "none", notes: doc.notes ?? "" } });
  const onSubmit = async (v: Out) => {
    const ok = await run(() => api.upsert("documents", doc.id, v).then(() => true), { success: "Documento atualizado.", invalidate: ["documents"] });
    if (ok) onClose(); else setError("Não foi possível guardar.");
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Editar documento</DialogTitle><DialogDescription>Altere o nome, o tipo ou o fornecedor associado.</DialogDescription></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-3" noValidate>
            <TextField control={form.control} name="name" label="Nome *" />
            <SelectField control={form.control} name="category" label="Tipo" options={entries(documentCategoryLabel)} />
            <FormField control={form.control} name="vendor_id" render={({ field }) => (
              <FormItem><FormLabel>Fornecedor</FormLabel>
                <Select value={field.value || "none"} onValueChange={field.onChange}><FormControl><SelectTrigger className="w-full"><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="none">Nenhum</SelectItem>{vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.company_name}</SelectItem>)}</SelectContent></Select>
              </FormItem>
            )} />
            <TextareaField control={form.control} name="notes" label="Observações" />
            <FormError message={error} />
            <DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={pending}>{pending && <Loader2 className="animate-spin" />}Guardar</Button></DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function DocumentsInner() {
  const params = useSearchParams();
  const docsQ = useDocuments();
  const vendors = useVendors().data ?? EMPTY;
  const api = useApi();
  const { run } = useRun();
  const confirm = useConfirm();
  const [q, setQ] = useState(params.get("busca") ?? "");
  const [cat, setCat] = useState<"all" | DocumentCategory>("all");
  const [upload, setUpload] = useState(false);
  const [edit, setEdit] = useState<DocumentRow | null>(null);

  const docs = docsQ.data ?? EMPTY;
  const rows = useMemo(() => docs.filter((d) => (cat === "all" || d.category === cat) && (!q || normalizeText([d.name, d.notes].filter(Boolean).join(" ")).includes(normalizeText(q)))), [docs, cat, q]);
  const counts = useMemo(() => { const c = new Map<string, number>(); docs.forEach((d) => c.set(d.category, (c.get(d.category) ?? 0) + 1)); return c; }, [docs]);

  // Miniaturas das imagens (URLs assinados de 1 hora).
  const imagePaths = useMemo(() => rows.filter((d) => isImage(d.mime_type, d.storage_path)).map((d) => d.storage_path), [rows]);
  const thumbs = useQuery({
    queryKey: ["wp-thumbs", imagePaths.join("|")],
    enabled: imagePaths.length > 0,
    staleTime: 50 * 60_000,
    queryFn: async () => {
      const { data } = await getSupabase().storage.from(BUCKET).createSignedUrls(imagePaths, 3600);
      return new Map((data ?? []).filter((x) => x.signedUrl && x.path).map((x) => [x.path as string, x.signedUrl as string]));
    },
  });

  const del = async (d: DocumentRow) => {
    if (!(await confirm({ title: `Eliminar “${d.name}”?`, description: "O ficheiro é apagado definitivamente." }))) return;
    await run(async () => { await api.remove("documents", d.id); await getSupabase().storage.from(BUCKET).remove([d.storage_path]); }, { success: "Documento eliminado.", invalidate: ["documents"] });
  };

  // Foco vindo da pesquisa global
  useEffect(() => { /* sem estado adicional */ }, []);

  return (
    <>
      <PageHeader title="Documentos" description="Contratos, orçamentos, faturas e inspirações, guardados em privado." actions={<Button onClick={() => setUpload(true)}><Upload /> Carregar documentos</Button>} />

      {docsQ.isPending ? <SkeletonCards n={4} /> : docsQ.isError ? <ErrorState onRetry={() => docsQ.refetch()} /> : docs.length === 0 ? (
        <EmptyState icon={FolderOpen} title="Ainda não há documentos" description="Guarde aqui os contratos assinados, os orçamentos dos fornecedores, as faturas e os comprovativos de pagamento. Só os noivos têm acesso." action={<Button onClick={() => setUpload(true)}><Upload /> Carregar o primeiro documento</Button>} />
      ) : (
        <>
          <div className="mb-3 grid gap-2">
            <div className="relative"><Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" placeholder="Pesquisar documentos…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Pesquisar documentos" /></div>
            <ToggleGroup type="single" value={cat} onValueChange={(v) => v && setCat(v as typeof cat)} className="w-full justify-start overflow-x-auto" aria-label="Filtrar por tipo">
              <ToggleGroupItem value="all" className="shrink-0">Todos ({docs.length})</ToggleGroupItem>
              {entries(documentCategoryLabel).map((o) => <ToggleGroupItem key={o.value} value={o.value} className="shrink-0">{o.label}{counts.get(o.value) ? ` (${counts.get(o.value)})` : ""}</ToggleGroupItem>)}
            </ToggleGroup>
          </div>

          {rows.length === 0 ? <EmptyState icon={Search} title="Nenhum documento corresponde" action={<Button variant="outline" onClick={() => { setQ(""); setCat("all"); }}>Limpar filtros</Button>} /> : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {rows.map((d) => {
                const Icon = fileIcon(d);
                const thumb = thumbs.data?.get(d.storage_path);
                return (
                  <Card key={d.id} className="gap-0 overflow-hidden py-0">
                    <button onClick={() => openSigned(d)} className="grid h-32 w-full place-items-center bg-secondary/60 transition-colors hover:bg-secondary" aria-label={`Abrir ${d.name}`}>
                      {thumb ?   <img src={thumb} alt="" className="size-full object-cover" loading="lazy" /> : <Icon className="size-9 text-sage-400" />}
                    </button>
                    <div className="grid gap-1.5 p-3">
                      <div className="flex items-start justify-between gap-1">
                        <p className="min-w-0 flex-1 truncate font-medium" title={d.name}>{d.name}</p>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" className="-mt-1 -mr-1.5" aria-label={`Ações para ${d.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => openSigned(d)}><Eye /> Ver</DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => openSigned(d, true)}><Download /> Descarregar</DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setEdit(d)}><Pencil /> Editar</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive" onSelect={() => del(d)}><Trash2 /> Eliminar</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5"><Badge variant="gold">{documentCategoryLabel[d.category]}</Badge>{d.vendor_id && <Badge variant="outline">{vendors.find((v) => v.id === d.vendor_id)?.company_name}</Badge>}</div>
                      <p className="text-xs text-muted-foreground">{formatBytes(d.size_bytes)} · {format(new Date(d.created_at), "dd/MM/yyyy")}</p>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      <UploadDialog open={upload} onOpenChange={setUpload} defaultCategory={cat === "all" ? "contrato" : cat} />
      {edit && <EditDialog doc={edit} onClose={() => setEdit(null)} />}
    </>
  );
}

export default function DocumentsPage() {
  return <Suspense fallback={<SkeletonCards n={4} />}><DocumentsInner /></Suspense>;
}
