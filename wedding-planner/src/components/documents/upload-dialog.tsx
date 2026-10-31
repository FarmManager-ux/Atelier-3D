"use client";

import { useRef, useState } from "react";
import { FileText, ImageIcon, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { getSupabase } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/errors";
import { useWeddingContext } from "@/lib/data/context";
import { useInvalidate, useVendors, EMPTY } from "@/lib/data/queries";
import { DOCUMENT_ACCEPT, DOCUMENT_MAX_BYTES } from "@/lib/validation";
import type { DocumentCategory } from "@/lib/db-types";
import { documentCategoryLabel, entries } from "@/lib/labels";
import { formatBytes, validateDocumentFile } from "./files";

export const BUCKET = "wedding-documents";

export function UploadDialog({ open, onOpenChange, defaultCategory = "contrato" }: { open: boolean; onOpenChange: (o: boolean) => void; defaultCategory?: DocumentCategory }) {
  const { wedding, user } = useWeddingContext();
  const vendors = useVendors().data ?? EMPTY;
  const invalidate = useInvalidate();
  const input = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [problems, setProblems] = useState<string[]>([]);
  const [category, setCategory] = useState<DocumentCategory>(defaultCategory);
  const [vendorId, setVendorId] = useState("none");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState<{ done: number; total: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const reset = () => { setFiles([]); setProblems([]); setNotes(""); setVendorId("none"); setBusy(null); if (input.current) input.current.value = ""; };
  const add = (list: FileList | File[]) => {
    const ok: File[] = [], bad: string[] = [];
    for (const f of Array.from(list)) { const err = validateDocumentFile(f); if (err) bad.push(`${f.name}: ${err}`); else ok.push(f); }
    setFiles((cur) => [...cur, ...ok].slice(0, 20)); setProblems(bad);
  };

  const submit = async () => {
    const supabase = getSupabase();
    setBusy({ done: 0, total: files.length });
    let okCount = 0;
    for (const f of files) {
      const id = crypto.randomUUID();
      const safe = f.name.normalize("NFKD").replace(/[^\w.\- ]+/g, "_").replace(/\s+/g, "_").slice(-100);
      const path = `${wedding.id}/${id}-${safe}`;
      const up = await supabase.storage.from(BUCKET).upload(path, f, { contentType: f.type || undefined, upsert: false });
      if (up.error) { toast.error(`${f.name}: ${friendlyError(up.error)}`); setBusy((b) => b && { ...b, done: b.done + 1 }); continue; }
      const ins = await supabase.from("documents").insert({ id, wedding_id: wedding.id, name: f.name.replace(/\.[^.]+$/, "").slice(0, 200), category, storage_path: path, mime_type: f.type || null, size_bytes: f.size, vendor_id: vendorId === "none" ? null : vendorId, notes: notes.trim() || null, uploaded_by: user.id }).select("id").single();
      if (ins.error) { await supabase.storage.from(BUCKET).remove([path]); toast.error(`${f.name}: ${friendlyError(ins.error)}`); } else okCount++;
      setBusy((b) => b && { ...b, done: b.done + 1 });
    }
    await invalidate("documents");
    if (okCount) toast.success(okCount === 1 ? "Documento carregado." : `${okCount} documentos carregados.`);
    if (okCount === files.length) { reset(); onOpenChange(false); } else { setFiles([]); setBusy(null); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) { onOpenChange(o); if (!o) reset(); } }}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>Carregar documentos</DialogTitle><DialogDescription>PDF, imagens, Word ou Excel até {formatBytes(DOCUMENT_MAX_BYTES)} cada. Ficam privados: só os noivos os veem.</DialogDescription></DialogHeader>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); add(e.dataTransfer.files); }}
          className={cn("grid place-items-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-colors", dragging ? "border-sage-400 bg-sage-50" : "border-input bg-secondary/40")}>
          <Upload className="size-6 text-sage-400" />
          <p className="text-sm">Arraste ficheiros para aqui ou</p>
          <input ref={input} id="doc-files" type="file" multiple accept={DOCUMENT_ACCEPT} className="sr-only" onChange={(e) => e.target.files && add(e.target.files)} />
          <Button asChild variant="outline" size="sm"><label htmlFor="doc-files" className="cursor-pointer">Escolher ficheiros</label></Button>
        </div>

        {problems.length > 0 && <ul role="alert" className="grid gap-1 rounded-md border border-[#e2b8b1] bg-[#fbf1ef] p-2.5 text-sm text-[#8a3b32]">{problems.map((p) => <li key={p}>{p}</li>)}</ul>}
        {files.length > 0 && (
          <ul className="grid max-h-40 gap-1.5 overflow-y-auto">
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-md border bg-card px-2.5 py-1.5 text-sm">
                {f.type.startsWith("image/") ? <ImageIcon className="size-4 text-sage-400" /> : <FileText className="size-4 text-sage-400" />}
                <span className="min-w-0 flex-1 truncate">{f.name}</span><span className="text-xs text-muted-foreground">{formatBytes(f.size)}</span>
                <Button variant="ghost" size="icon-sm" disabled={!!busy} onClick={() => setFiles((c) => c.filter((_, j) => j !== i))} aria-label={`Remover ${f.name}`}><Trash2 /></Button>
              </li>
            ))}
          </ul>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5"><Label htmlFor="doc-cat">Tipo de documento</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as DocumentCategory)}><SelectTrigger id="doc-cat" className="w-full"><SelectValue /></SelectTrigger><SelectContent>{entries(documentCategoryLabel).map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select></div>
          <div className="grid gap-1.5"><Label htmlFor="doc-vendor">Fornecedor (opcional)</Label>
            <Select value={vendorId} onValueChange={setVendorId}><SelectTrigger id="doc-vendor" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Nenhum</SelectItem>{vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.company_name}</SelectItem>)}</SelectContent></Select></div>
          <div className="grid gap-1.5 sm:col-span-2"><Label htmlFor="doc-notes">Observações (opcional)</Label><Input id="doc-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} /></div>
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={!!busy} onClick={() => { onOpenChange(false); reset(); }}>Cancelar</Button>
          <Button disabled={!files.length || !!busy} onClick={submit}>{busy ? <><Loader2 className="animate-spin" />A carregar {busy.done}/{busy.total}…</> : <>Carregar {files.length || ""} {files.length === 1 ? "ficheiro" : "ficheiros"}</>}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
