"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ExternalLink, Mail, MoreHorizontal, Pencil, Phone, Plus, Receipt, Search, Store, Trash2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ExpenseDialog } from "@/components/budget/expense-dialog";
import { useConfirm } from "@/components/confirm";
import { EmptyState, ErrorState, PageHeader, SkeletonCards, Stat } from "@/components/page";
import { PaymentBadge, VendorBadge } from "@/components/status";
import { VendorDialog } from "@/components/vendors/vendor-dialog";
import { useApi, useRun } from "@/lib/data/actions";
import { useCategories, useExpenses, useVendors, EMPTY } from "@/lib/data/queries";
import { expensesOfVendor } from "@/lib/domain/budget";
import { normalizeText } from "@/lib/domain/guests";
import { formatEuro } from "@/lib/money";
import type { Vendor, VendorStatus } from "@/lib/db-types";
import { entries, vendorStatusLabel } from "@/lib/labels";

function VendorsInner() {
  const params = useSearchParams();
  const vendorsQ = useVendors();
  const expenses = useExpenses().data ?? EMPTY;
  const categories = useCategories().data ?? EMPTY;
  const api = useApi();
  const { run } = useRun();
  const confirm = useConfirm();
  const [q, setQ] = useState(params.get("busca") ?? "");
  const [status, setStatus] = useState<"all" | VendorStatus>("all");
  const [dlg, setDlg] = useState<{ open: boolean; vendor: Vendor | null }>({ open: false, vendor: null });
  const [expense, setExpense] = useState<{ open: boolean; vendorId: string | null }>({ open: false, vendorId: null });

  const vendors = vendorsQ.data ?? EMPTY;
  const rows = useMemo(() => vendors.filter((v) => (status === "all" || v.status === status) && (!q || normalizeText([v.company_name, v.service_type, v.contact_name, v.email].filter(Boolean).join(" ")).includes(normalizeText(q)))), [vendors, status, q]);
  const contracted = vendors.filter((v) => v.status === "contratado");
  const totalContracted = contracted.reduce((a, v) => a + (v.contracted_amount ?? 0), 0);
  const totalQuoted = vendors.reduce((a, v) => a + (v.quoted_amount ?? 0), 0);

  const del = async (v: Vendor) => {
    const n = expensesOfVendor(v, expenses).list.length;
    if (n > 0) { await confirm({ title: "Não é possível eliminar", description: `${v.company_name} tem ${n} ${n === 1 ? "despesa associada" : "despesas associadas"}. Mude ou elimine primeiro essas despesas no Orçamento.`, confirmLabel: "Percebi" }); return; }
    if (await confirm({ title: `Eliminar ${v.company_name}?`, description: "Os documentos associados ficam sem fornecedor." }))
      await run(() => api.remove("vendors", v.id), { success: "Fornecedor eliminado.", invalidate: ["vendors", "documents", "calendar_events"] });
  };

  return (
    <>
      <PageHeader title="Fornecedores" description="Contactos, valores e estado da contratação de cada fornecedor." actions={<Button onClick={() => setDlg({ open: true, vendor: null })}><Plus /> Novo fornecedor</Button>} />

      {vendorsQ.isPending ? <SkeletonCards n={3} /> : vendorsQ.isError ? <ErrorState onRetry={() => vendorsQ.refetch()} /> : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Fornecedores" value={vendors.length} icon={Store} />
            <Stat label="Contratados" value={contracted.length} tone="gold" hint={`de ${vendors.length}`} />
            <Stat label="Valor contratado" value={formatEuro(totalContracted)} />
            <Stat label="Valor orçamentado" value={formatEuro(totalQuoted)} hint="Soma de todos os orçamentos" />
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="relative min-w-52 flex-1"><Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" placeholder="Pesquisar fornecedor, serviço ou contacto…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Pesquisar fornecedores" /></div>
            <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}><SelectTrigger size="sm" aria-label="Filtrar por estado"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos os estados</SelectItem>{entries(vendorStatusLabel).map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select>
          </div>

          {vendors.length === 0 ? (
            <EmptyState icon={Store} title="Ainda não há fornecedores" description="Guarde aqui o fotógrafo, o espaço, o catering… com contactos, orçamentos e o estado da contratação." action={<Button onClick={() => setDlg({ open: true, vendor: null })}><Plus /> Adicionar fornecedor</Button>} />
          ) : rows.length === 0 ? <EmptyState icon={Search} title="Nenhum fornecedor corresponde à pesquisa" action={<Button variant="outline" onClick={() => { setQ(""); setStatus("all"); }}>Limpar filtros</Button>} /> : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {rows.map((v) => {
                const ex = expensesOfVendor(v, expenses);
                return (
                  <Card key={v.id} className="gap-3">
                    <CardContent className="grid gap-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0"><button className="block max-w-full truncate text-left font-serif text-xl font-semibold hover:underline" onClick={() => setDlg({ open: true, vendor: v })}>{v.company_name}</button><p className="truncate text-sm text-muted-foreground">{v.service_type ?? "Sem tipo de serviço"}</p></div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Ações para ${v.company_name}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => setDlg({ open: true, vendor: v })}><Pencil /> Editar</DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setExpense({ open: true, vendorId: v.id })}><Receipt /> Associar despesa</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive" onSelect={() => del(v)}><Trash2 /> Eliminar</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <div><VendorBadge status={v.status} /></div>
                      <ul className="grid gap-1 text-sm">
                        {v.contact_name && <li className="flex items-center gap-2"><UserRound className="size-4 text-sage-400" />{v.contact_name}</li>}
                        {v.phone && <li className="flex items-center gap-2"><Phone className="size-4 text-sage-400" /><a className="hover:underline" href={`tel:${v.phone.replace(/\s/g, "")}`}>{v.phone}</a></li>}
                        {v.email && <li className="flex items-center gap-2"><Mail className="size-4 text-sage-400" /><a className="truncate hover:underline" href={`mailto:${v.email}`}>{v.email}</a></li>}
                        {v.website && <li className="flex items-center gap-2"><ExternalLink className="size-4 text-sage-400" /><a className="truncate hover:underline" href={v.website} target="_blank" rel="noreferrer noopener">{v.website.replace(/^https?:\/\//, "")}</a></li>}
                      </ul>
                      <dl className="grid grid-cols-2 gap-2 rounded-lg bg-secondary/60 p-2.5 text-sm"><div><dt className="text-xs text-muted-foreground">Orçamentado</dt><dd className="tabular-nums">{v.quoted_amount === null ? "—" : formatEuro(v.quoted_amount)}</dd></div><div><dt className="text-xs text-muted-foreground">Contratado</dt><dd className="font-medium tabular-nums">{v.contracted_amount === null ? "—" : formatEuro(v.contracted_amount)}</dd></div></dl>
                      {ex.list.length > 0 && (
                        <details className="text-sm">
                          <summary className="cursor-pointer text-muted-foreground">{ex.list.length} {ex.list.length === 1 ? "despesa associada" : "despesas associadas"} · pago {formatEuro(ex.paid)} de {formatEuro(ex.planned)}</summary>
                          <ul className="mt-2 grid gap-1">{ex.list.map((e) => <li key={e.id} className="flex items-center justify-between gap-2 rounded-md px-2 py-1 hover:bg-secondary"><span className="truncate">{e.description}<span className="ml-1 text-xs text-muted-foreground">({categories.find((c) => c.id === e.category_id)?.name})</span></span><PaymentBadge status={e.payment_status} /></li>)}</ul>
                        </details>
                      )}
                      {v.notes && <p className="line-clamp-3 text-sm text-muted-foreground">{v.notes}</p>}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      <VendorDialog open={dlg.open} onOpenChange={(o) => setDlg((s) => ({ ...s, open: o }))} vendor={dlg.vendor} />
      <ExpenseDialog open={expense.open} onOpenChange={(o) => setExpense((s) => ({ ...s, open: o }))} defaults={expense.vendorId ? { vendor_id: expense.vendorId } : undefined} />
    </>
  );
}

export default function VendorsPage() {
  return <Suspense fallback={<SkeletonCards n={3} />}><VendorsInner /></Suspense>;
}
