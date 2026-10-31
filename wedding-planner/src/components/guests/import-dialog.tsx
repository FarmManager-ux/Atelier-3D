"use client";

import { useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApi, useRun } from "@/lib/data/actions";
import { useGroups, useGuests, useWedding, EMPTY } from "@/lib/data/queries";
import { parseGuestRows, type ParseResult } from "@/lib/domain/csv";
import { categoryLabel, invitationStatusLabel, rsvpStatusLabel, sideLabel } from "@/lib/labels";
import { downloadTemplate, readSpreadsheet } from "./download";

export function ImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const wedding = useWedding();
  const guests = useGuests().data ?? EMPTY;
  const groups = useGroups().data ?? EMPTY;
  const api = useApi();
  const { run, pending } = useRun();
  const input = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [fileName, setFileName] = useState("");
  const [readError, setReadError] = useState<string | null>(null);
  const [withDuplicates, setWithDuplicates] = useState(false);
  const [reading, setReading] = useState(false);

  const reset = () => { setResult(null); setFileName(""); setReadError(null); setWithDuplicates(false); if (input.current) input.current.value = ""; };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setReadError(null); setResult(null); setFileName(file.name); setReading(true);
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error("O ficheiro é demasiado grande (máximo 5 MB).");
      const rows = await readSpreadsheet(file);
      if (rows.length > 2000) throw new Error("O ficheiro tem demasiadas linhas (máximo 2000).");
      setResult(parseGuestRows(rows, wedding, guests));
    } catch (e) {
      setReadError(e instanceof Error ? e.message : "Não foi possível ler o ficheiro.");
    } finally { setReading(false); }
  };

  const toImport = result ? result.rows.filter((r) => withDuplicates || !r.duplicate) : [];
  const people = toImport.reduce((a, r) => a + 1 + r.guest.companions_count + r.guest.children_count, 0);

  const doImport = async () => {
    const n = await run(() => api.importGuests(toImport, groups), { success: `${toImport.length} convidados importados.`, invalidate: ["guests", "guest_groups", "invitations"] });
    if (n) { reset(); onOpenChange(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Importar convidados</DialogTitle>
          <DialogDescription>Carregue um ficheiro CSV ou Excel (.xlsx). Verifica tudo antes de guardar: só importa depois de confirmar.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <input ref={input} id="import-file" type="file" accept=".csv,.txt,.xlsx" className="sr-only" onChange={(e) => void onFile(e.target.files?.[0])} />
          <Button asChild variant="outline"><label htmlFor="import-file" className="cursor-pointer"><Upload /> Escolher ficheiro</label></Button>
          <Button variant="ghost" onClick={downloadTemplate}><FileSpreadsheet /> Descarregar modelo</Button>
          {fileName && <span className="truncate text-sm text-muted-foreground">{fileName}</span>}
        </div>

        {reading && <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status"><Loader2 className="size-4 animate-spin" /> A ler o ficheiro…</p>}
        {readError && <p role="alert" className="rounded-md border border-[#e2b8b1] bg-[#fbf1ef] px-3 py-2 text-sm text-[#8a3b32]">{readError}</p>}

        {result?.missingNameColumn && (
          <p role="alert" className="rounded-md border border-[#e2b8b1] bg-[#fbf1ef] px-3 py-2 text-sm text-[#8a3b32]">Não encontrámos a coluna “Nome completo”. Use o modelo para garantir os cabeçalhos certos.</p>
        )}

        {result && !result.missingNameColumn && (
          <div className="grid gap-3">
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variant="success"><CheckCircle2 />{result.rows.filter((r) => !r.duplicate).length} prontos a importar</Badge>
              {result.rows.some((r) => r.duplicate) && <Badge variant="warning">{result.rows.filter((r) => r.duplicate).length} possíveis duplicados</Badge>}
              {result.errors.length > 0 && <Badge variant="danger"><AlertTriangle />{result.errors.length} linhas com erros</Badge>}
              {result.newGroups.length > 0 && <Badge variant="gold">{result.newGroups.length} grupos novos</Badge>}
            </div>
            {result.unknownHeaders.length > 0 && <p className="text-xs text-muted-foreground">Colunas ignoradas (não reconhecidas): {result.unknownHeaders.join(", ")}.</p>}
            {result.rows.some((r) => r.duplicate) && (
              <div className="flex items-center gap-2"><Checkbox id="dups" checked={withDuplicates} onCheckedChange={(c) => setWithDuplicates(c === true)} /><Label htmlFor="dups" className="font-normal">Importar também os possíveis duplicados</Label></div>
            )}
            {result.errors.length > 0 && (
              <details className="rounded-md border bg-card p-3 text-sm" open={result.rows.length === 0}>
                <summary className="cursor-pointer font-medium text-[#8a3b32]">Ver linhas com erros (não serão importadas)</summary>
                <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto">{result.errors.map((e) => <li key={e.rowNumber}><strong>Linha {e.rowNumber}:</strong> {e.message}</li>)}</ul>
              </details>
            )}
            {result.rows.length > 0 && (
              <div className="max-h-64 overflow-auto rounded-md border">
                <Table>
                  <TableHeader><TableRow><TableHead>Linha</TableHead><TableHead>Nome</TableHead><TableHead>Lado</TableHead><TableHead>Categoria</TableHead><TableHead>Pessoas</TableHead><TableHead>Convite</TableHead><TableHead>Presença</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {result.rows.slice(0, 50).map((r) => (
                      <TableRow key={r.rowNumber} className={r.duplicate && !withDuplicates ? "opacity-50" : undefined}>
                        <TableCell>{r.rowNumber}</TableCell>
                        <TableCell className="font-medium">{r.guest.full_name}{r.duplicate && <Badge variant="warning" className="ml-2">duplicado</Badge>}</TableCell>
                        <TableCell>{sideLabel(r.guest.side, wedding)}</TableCell>
                        <TableCell>{categoryLabel[r.guest.category]}</TableCell>
                        <TableCell>{1 + r.guest.companions_count + r.guest.children_count}</TableCell>
                        <TableCell>{invitationStatusLabel[r.guest.invitation_status]}</TableCell>
                        <TableCell>{rsvpStatusLabel[r.guest.rsvp_status]}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {result.rows.length > 50 && <p className="p-2 text-center text-xs text-muted-foreground">A mostrar 50 de {result.rows.length} linhas.</p>}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={doImport} disabled={!toImport.length || pending}>{pending && <Loader2 className="animate-spin" />}Importar {toImport.length > 0 ? `${toImport.length} convidados (${people} pessoas)` : ""}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
