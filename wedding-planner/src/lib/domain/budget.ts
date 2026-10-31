import type { BudgetCategory, Expense, Vendor } from "../db-types";

export interface BudgetSummary {
  totalBudget: number;       // orçamento total previsto (definido nas definições)
  planned: number;           // soma dos valores previstos das despesas
  paid: number;              // total já gasto (efetivamente pago)
  toPay: number;             // total por pagar (previsto − pago, nunca negativo)
  difference: number;        // orçamento − previsto (positivo = margem; negativo = acima do orçamento)
  remainingAfterPaid: number; // orçamento − já pago
  usedShare: number;         // previsto / orçamento (0 se não houver orçamento)
  overBudget: boolean;
}

export function computeBudget(totalBudget: number, expenses: Expense[]): BudgetSummary {
  const planned = round(expenses.reduce((a, e) => a + e.planned_amount, 0));
  const paid = round(expenses.reduce((a, e) => a + e.paid_amount, 0));
  const toPay = round(expenses.reduce((a, e) => a + Math.max(0, e.planned_amount - e.paid_amount), 0));
  return {
    totalBudget, planned, paid, toPay,
    difference: round(totalBudget - planned),
    remainingAfterPaid: round(totalBudget - paid),
    usedShare: totalBudget > 0 ? planned / totalBudget : 0,
    overBudget: totalBudget > 0 && planned > totalBudget,
  };
}

export interface CategorySummary { category: BudgetCategory; planned: number; paid: number; toPay: number; count: number; allotment: number; overAllotment: boolean }

export function byCategory(categories: BudgetCategory[], expenses: Expense[]): CategorySummary[] {
  return categories.map((category) => {
    const list = expenses.filter((e) => e.category_id === category.id);
    const planned = round(list.reduce((a, e) => a + e.planned_amount, 0));
    const paid = round(list.reduce((a, e) => a + e.paid_amount, 0));
    return { category, planned, paid, toPay: round(list.reduce((a, e) => a + Math.max(0, e.planned_amount - e.paid_amount), 0)), count: list.length,
      allotment: category.planned_budget, overAllotment: category.planned_budget > 0 && planned > category.planned_budget };
  });
}

export function expensesOfVendor(vendor: Vendor, expenses: Expense[]) {
  const list = expenses.filter((e) => e.vendor_id === vendor.id);
  return { list, planned: round(list.reduce((a, e) => a + e.planned_amount, 0)), paid: round(list.reduce((a, e) => a + e.paid_amount, 0)) };
}

/** Pagamentos em atraso: com valor por pagar e data limite já passada. */
export function overdue(expenses: Expense[], today: string): Expense[] {
  return expenses.filter((e) => e.due_date && e.due_date < today && e.paid_amount < e.planned_amount);
}

const round = (n: number) => Math.round(n * 100) / 100;
