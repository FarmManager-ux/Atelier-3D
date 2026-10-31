"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { AlertTriangle, CheckCircle2, CircleDollarSign, FolderCog, MoreHorizontal, Pencil, PiggyBank, Plus, Receipt, Search, Trash2, TrendingDown, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BudgetDonut, PlannedVsPaid } from "@/components/budget/charts";
import { CategoriesDialog } from "@/components/budget/categories-dialog";
import { ExpenseDialog } from "@/components/budget/expense-dialog";
import { useConfirm } from "@/components/confirm";
import { EmptyState, ErrorState, PageHeader, SkeletonCards, SkeletonRows, Stat } from "@/components/page";
import { PaymentBadge } from "@/components/status";
import { useApi, useRun } from "@/lib/data/actions";
import { useCategories, useExpenses, useVendors, useWedding, EMPTY } from "@/lib/data/queries";
import { formatShortDate } from "@/lib/dates";
import { byCategory, computeBudget } from "@/lib/domain/budget";
import { normalizeText } from "@/lib/domain/guests";
import { formatEuro } from "@/lib/money";
import type { Expense, PaymentStatus } from "@/lib/db-types";
import { entries, paymentStatusLabel } from "@/lib/labels";
import Link from "next/link";

function BudgetInner() {
  const params = useSearchParams();
  const wedding = useWedding();
  const expQ = useExpenses();
  const catQ = useCategories();
  const vendors = useVendors().data ?? EMPTY;
  const api = useApi();
  const { run } = useRun();
  const confirm = useConfirm();
  const [q, setQ] = useState(params.get("busca") ?? "");
  const [cat, setCat] = useState("all");
  const [status, setStatus] = useState<"all" | PaymentStatus>("all");
  const [edit, setEdit] = useState<{ open: boolean; expense: Expense | null }>({ open: false, expense: null });
  const [catsOpen, setCatsOpen] = useState(false);

  const expenses = expQ.data ?? EMPTY;
  const categories = catQ.data ?? EMPTY;
  const summary = useMemo(() => computeBudget(wedding.total_budget, expenses), [wedding.total_budget, expenses]);
  const perCat = useMemo(() => byCategory(categories, expenses), [categories, expenses]);
  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? "—";
  const vendorName = (id: string | null) => vendors.find((v) => v.id === id)?.company_name;
  const today = format(new Date(), "yyyy-MM-dd");

  const rows = useMemo(() => expenses.filter((e) => {
    if (cat !== "all" && e.category_id !== cat) return false;
    if (status !== "all" && e.payment_status !== status) return false;
    return !q || normalizeText([e.description, catName(e.category_id), vendorName(e.vendor_id)].filter(Boolean).join(" ")).includes(normalizeText(q));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }).sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") || a.description.localeCompare(b.description, "pt")), [expenses, cat, status, q, categories, vendors]);

  const donut = perCat.filter((c) => c.planned > 0).map((c) => ({ name: c.category.name, value: c.planned })).sort((a, b) => b.value - a.value);
  const bars = perCat.filter((c) => c.planned > 0 || c.paid > 0).map((c) => ({ name: c.category.name, previsto: c.planned, pago: c.paid }));

  const openNew = () => setEdit({ open: true, expense: null });
  const del = async (e: Expense) => { if (await confirm({ title: `Eliminar “${e.description}”?`, description: "Esta ação não pode ser desfeita." })) await run(() => api.remove("expenses", e.id), { success: "Despesa eliminada.", invalidate: ["expenses", "documents"] }); };
  const markPaid = (e: Expense) => run(() => api.upsert("expenses", e.id, { paid_amount: e.planned_amount, payment_date: today }), { success: "Marcada como paga.", invalidate: ["expenses"] });
  const isOverdue = (e: Expense) => !!e.due_date && e.due_date < today && e.paid_amount < e.planned_amount;

  const loading = expQ.isPending || catQ.isPending;

  return (
    <>
      <PageHeader title="Orçamento" description="Acompanhe o que está previsto, o que já foi pago e o que falta pagar." actions={<><Button onClick={openNew}><Plus /> Nova despesa</Button><Button variant="outline" onClick={() => setCatsOpen(true)}><FolderCog /> Categorias</Button></>} />

      {loading ? <SkeletonCards n={4} /> : expQ.isError ? <ErrorState onRetry={() => expQ.refetch()} /> : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Stat label="Orçamento total" value={formatEuro(summary.totalBudget)} icon={Wallet} hint={summary.totalBudget ? "Definido nas Definições" : <Link href="/definicoes" className="underline underline-offset-2">Definir o orçamento</Link>} className="col-span-2 lg:col-span-1" />
            <Stat label="Previsto" value={formatEuro(summary.planned)} icon={Receipt} hint={`${expenses.length} despesas`} />
            <Stat label="Já gasto" value={formatEuro(summary.paid)} icon={CheckCircle2} tone="gold" hint="Valor efetivamente pago" />
            <Stat label="Por pagar" value={formatEuro(summary.toPay)} icon={CircleDollarSign} tone="warning" hint="Previsto menos pago" />
            <Stat label={summary.difference >= 0 ? "Margem" : "Acima do orçamento"} value={formatEuro(Math.abs(summary.difference))} icon={summary.difference >= 0 ? PiggyBank : TrendingDown} tone={summary.difference >= 0 ? "default" : "warning"} hint={summary.difference >= 0 ? "Orçamento − previsto" : "O previsto excede o orçamento"} />
          </div>

          {summary.totalBudget > 0 && (
            <Card className="mb-4 gap-2 py-3">
              <CardContent>
                <div className="mb-1.5 flex items-center justify-between text-sm"><span>Orçamento comprometido</span><span className="tabular-nums font-medium">{Math.round(summary.usedShare * 100)}%</span></div>
                <Progress value={summary.usedShare * 100} indicatorClassName={summary.overBudget ? "bg-destructive" : undefined} aria-label="Percentagem do orçamento comprometida" />
                {summary.overBudget && <p className="mt-2 flex items-center gap-1.5 text-sm text-destructive"><AlertTriangle className="size-4" />O valor previsto das despesas ultrapassa o orçamento total em {formatEuro(-summary.difference)}.</p>}
              </CardContent>
            </Card>
          )}

          <div className="mb-5 grid gap-4 lg:grid-cols-2">
            <Card><CardHeader><CardTitle>Distribuição das despesas</CardTitle><CardDescription>Valor previsto por categoria</CardDescription></CardHeader><CardContent>{donut.length ? <BudgetDonut data={donut} /> : <p className="py-10 text-center text-sm text-muted-foreground">Registe despesas para ver a distribuição.</p>}</CardContent></Card>
            <Card><CardHeader><CardTitle>Previsto vs. pago</CardTitle><CardDescription>Por categoria</CardDescription></CardHeader><CardContent>{bars.length ? <PlannedVsPaid data={bars} /> : <p className="py-10 text-center text-sm text-muted-foreground">Sem dados para mostrar ainda.</p>}</CardContent></Card>
          </div>

          <Tabs defaultValue="despesas">
            <TabsList><TabsTrigger value="despesas">Despesas</TabsTrigger><TabsTrigger value="categorias">Por categoria</TabsTrigger></TabsList>

            <TabsContent value="despesas" className="grid gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-48 flex-1"><Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" placeholder="Pesquisar despesa, categoria ou fornecedor…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Pesquisar despesas" /></div>
                <Select value={cat} onValueChange={setCat}><SelectTrigger size="sm" aria-label="Filtrar por categoria"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todas as categorias</SelectItem>{categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
                <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}><SelectTrigger size="sm" aria-label="Filtrar por estado do pagamento"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos os estados</SelectItem>{entries(paymentStatusLabel).map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select>
              </div>

              {expenses.length === 0 ? (
                <EmptyState icon={Receipt} title="Ainda não há despesas" description="Registe a primeira despesa (por exemplo, o sinal do espaço) para acompanhar o que já foi pago e o que falta." action={<Button onClick={openNew}><Plus /> Registar despesa</Button>} />
              ) : rows.length === 0 ? <EmptyState icon={Search} title="Nenhuma despesa corresponde aos filtros" action={<Button variant="outline" onClick={() => { setQ(""); setCat("all"); setStatus("all"); }}>Limpar filtros</Button>} /> : (
                <>
                  <div className="hidden rounded-xl border bg-card md:block">
                    <Table>
                      <TableHeader><TableRow><TableHead>Despesa</TableHead><TableHead className="hidden lg:table-cell">Fornecedor</TableHead><TableHead className="text-right">Previsto</TableHead><TableHead className="text-right">Pago</TableHead><TableHead>Estado</TableHead><TableHead>Data limite</TableHead><TableHead className="w-10"><span className="sr-only">Ações</span></TableHead></TableRow></TableHeader>
                      <TableBody>
                        {rows.map((e) => (
                          <TableRow key={e.id}>
                            <TableCell className="max-w-[16rem]"><button className="block max-w-full truncate text-left font-medium hover:underline" onClick={() => setEdit({ open: true, expense: e })}>{e.description}</button><p className="text-xs text-muted-foreground">{catName(e.category_id)}</p></TableCell>
                            <TableCell className="hidden text-sm lg:table-cell">{vendorName(e.vendor_id) ?? <span className="text-muted-foreground">—</span>}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatEuro(e.planned_amount)}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatEuro(e.paid_amount)}</TableCell>
                            <TableCell><PaymentBadge status={e.payment_status} /></TableCell>
                            <TableCell className="text-sm">{isOverdue(e) ? <span className="flex items-center gap-1 font-medium text-destructive"><AlertTriangle className="size-3.5" />{formatShortDate(e.due_date)}</span> : formatShortDate(e.due_date)}</TableCell>
                            <TableCell><ExpenseMenu e={e} onEdit={() => setEdit({ open: true, expense: e })} onPaid={() => markPaid(e)} onDelete={() => del(e)} /></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <ul className="grid gap-2 md:hidden">
                    {rows.map((e) => (
                      <li key={e.id} className="rounded-xl border bg-card p-3">
                        <div className="flex items-start gap-2"><button className="min-w-0 flex-1 text-left" onClick={() => setEdit({ open: true, expense: e })}><span className="block truncate font-medium">{e.description}</span><span className="block truncate text-xs text-muted-foreground">{[catName(e.category_id), vendorName(e.vendor_id)].filter(Boolean).join(" · ")}</span></button><ExpenseMenu e={e} onEdit={() => setEdit({ open: true, expense: e })} onPaid={() => markPaid(e)} onDelete={() => del(e)} /></div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm"><PaymentBadge status={e.payment_status} /><span className="tabular-nums">{formatEuro(e.paid_amount)} / {formatEuro(e.planned_amount)}</span>{e.due_date && <span className={isOverdue(e) ? "ml-auto font-medium text-destructive" : "ml-auto text-xs text-muted-foreground"}>até {formatShortDate(e.due_date)}</span>}</div>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </TabsContent>

            <TabsContent value="categorias">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {perCat.map((c) => (
                  <Card key={c.category.id} className="gap-2 py-4">
                    <CardContent>
                      <div className="flex items-center justify-between gap-2"><p className="font-serif text-lg font-semibold">{c.category.name}</p>{c.overAllotment && <Badge variant="danger">Acima da verba</Badge>}</div>
                      <p className="mt-0.5 text-xs text-muted-foreground">{c.count} {c.count === 1 ? "despesa" : "despesas"}{c.allotment > 0 && ` · verba ${formatEuro(c.allotment)}`}</p>
                      <dl className="mt-2 grid grid-cols-3 gap-2 text-sm"><div><dt className="text-xs text-muted-foreground">Previsto</dt><dd className="tabular-nums">{formatEuro(c.planned)}</dd></div><div><dt className="text-xs text-muted-foreground">Pago</dt><dd className="tabular-nums">{formatEuro(c.paid)}</dd></div><div><dt className="text-xs text-muted-foreground">Por pagar</dt><dd className="tabular-nums">{formatEuro(c.toPay)}</dd></div></dl>
                      {c.planned > 0 && <Progress className="mt-2" value={c.planned ? (c.paid / c.planned) * 100 : 0} aria-label={`${c.category.name}: ${formatEuro(c.paid)} pagos de ${formatEuro(c.planned)}`} />}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}

      <ExpenseDialog open={edit.open} onOpenChange={(o) => setEdit((s) => ({ ...s, open: o }))} expense={edit.expense} />
      <CategoriesDialog open={catsOpen} onOpenChange={setCatsOpen} />
    </>
  );
}

function ExpenseMenu({ e, onEdit, onPaid, onDelete }: { e: Expense; onEdit: () => void; onPaid: () => void; onDelete: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Ações para ${e.description}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onEdit}><Pencil /> Editar</DropdownMenuItem>
        {e.paid_amount < e.planned_amount && <DropdownMenuItem onSelect={onPaid}><CheckCircle2 /> Marcar como pago</DropdownMenuItem>}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={onDelete}><Trash2 /> Eliminar</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function BudgetPage() {
  return <Suspense fallback={<SkeletonRows n={6} />}><BudgetInner /></Suspense>;
}
