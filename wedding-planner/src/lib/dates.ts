import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { pt } from "date-fns/locale";

/** Datas "yyyy-MM-dd" são tratadas como datas de calendário locais (sem fuso). */
export const parseDate = (d: string): Date => parseISO(d.length === 10 ? `${d}T00:00:00` : d);
export const toISODate = (d: Date): string => format(d, "yyyy-MM-dd");
export const formatDate = (d: string | null | undefined, pattern = "d 'de' MMMM 'de' yyyy"): string =>
  d ? format(parseDate(d), pattern, { locale: pt }) : "—";
export const formatShortDate = (d: string | null | undefined): string => (d ? format(parseDate(d), "dd/MM/yyyy") : "—");
export const formatDateTime = (d: string | null | undefined): string => (d ? format(parseISO(d), "dd/MM/yyyy HH:mm") : "—");

export function daysUntil(date: string, today: Date = new Date()): number {
  return differenceInCalendarDays(parseDate(date), today);
}

export interface Countdown { days: number; past: boolean; today: boolean; weeks: number; months: number; label: string }

export function countdown(date: string, today: Date = new Date()): Countdown {
  const days = daysUntil(date, today);
  const abs = Math.abs(days);
  const label = days === 0 ? "É hoje!" : days === 1 ? "Falta 1 dia" : days > 1 ? `Faltam ${days} dias` : days === -1 ? "Foi ontem" : `Passaram ${abs} dias`;
  return { days, past: days < 0, today: days === 0, weeks: Math.floor(abs / 7), months: Math.floor(abs / 30.4375), label };
}
