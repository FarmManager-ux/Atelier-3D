import { Armchair, CalendarDays, FileText, LayoutDashboard, ListChecks, MailCheck, Settings, Store, Users, Wallet, type LucideIcon } from "lucide-react";

export interface NavItem { href: string; label: string; short: string; icon: LucideIcon }

export const NAV: NavItem[] = [
  { href: "/", label: "Dashboard", short: "Início", icon: LayoutDashboard },
  { href: "/convidados", label: "Convidados", short: "Convidados", icon: Users },
  { href: "/convites", label: "Convites e confirmações", short: "Convites", icon: MailCheck },
  { href: "/mesas", label: "Organização das mesas", short: "Mesas", icon: Armchair },
  { href: "/orcamento", label: "Orçamento", short: "Orçamento", icon: Wallet },
  { href: "/tarefas", label: "Tarefas", short: "Tarefas", icon: ListChecks },
  { href: "/fornecedores", label: "Fornecedores", short: "Fornecedores", icon: Store },
  { href: "/documentos", label: "Documentos", short: "Documentos", icon: FileText },
  { href: "/calendario", label: "Calendário", short: "Calendário", icon: CalendarDays },
  { href: "/definicoes", label: "Definições", short: "Definições", icon: Settings },
];

export const isActive = (pathname: string, href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));
