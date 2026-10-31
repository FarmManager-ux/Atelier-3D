"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Heart, LogOut, Menu, MoreHorizontal, Search, Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { getSupabase } from "@/lib/supabase/client";
import { useWedding } from "@/lib/data/queries";
import { useWeddingContext } from "@/lib/data/context";
import { useRealtimeSync } from "@/lib/data/realtime";
import { countdown } from "@/lib/dates";
import { GlobalSearch } from "./global-search";
import { NAV, isActive } from "./nav";

function Brand({ compact = false }: { compact?: boolean }) {
  const w = useWedding();
  return (
    <Link href="/" className="flex min-w-0 items-center gap-2.5" aria-label="Ir para o dashboard">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-sage-100 text-gold-600"><Heart className="size-4 fill-current" /></span>
      {!compact && (
        <span className="min-w-0 leading-tight">
          <span className="block truncate font-serif text-lg font-semibold text-sage-900">{w.name}</span>
          <span className="block truncate text-xs text-muted-foreground">{w.partner1_name} &amp; {w.partner2_name}</span>
        </span>
      )}
    </Link>
  );
}

function NavLinks({ onNavigate, rail = false }: { onNavigate?: () => void; rail?: boolean }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Navegação principal" className="flex flex-col gap-0.5">
      {NAV.map((n) => {
        const active = isActive(pathname, n.href);
        const link = (
          <Link key={n.href} href={n.href} onClick={onNavigate} aria-current={active ? "page" : undefined}
            className={cn("group relative flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
              rail && "justify-center px-0",
              active ? "bg-sage-100 text-sage-900" : "text-muted-foreground hover:bg-secondary hover:text-foreground")}>
            {active && <span className="absolute top-2 bottom-2 left-0 w-0.5 rounded-full bg-gold" />}
            <n.icon className={cn("size-[18px] shrink-0", active ? "text-sage-600" : "text-sage-400 group-hover:text-sage-600")} />
            <span className={cn(rail && "sr-only")}>{n.label}</span>
          </Link>
        );
        return rail ? <Tooltip key={n.href}><TooltipTrigger asChild>{link}</TooltipTrigger><TooltipContent side="right">{n.label}</TooltipContent></Tooltip> : link;
      })}
    </nav>
  );
}

function UserMenu({ compact = false }: { compact?: boolean }) {
  const { user } = useWeddingContext();
  const router = useRouter();
  const logout = async () => {
    await getSupabase().auth.signOut();
    toast.success("Sessão terminada.");
    router.replace("/entrar");
    router.refresh();
  };
  const initial = (user.email ?? "?").charAt(0).toUpperCase();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className={cn("flex min-w-0 items-center gap-2.5 rounded-md p-1.5 text-left transition-colors outline-none hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring/60", compact && "justify-center")} aria-label="Menu da conta">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-sage-200 text-sm font-semibold text-sage-800">{initial}</span>
          {!compact && <span className="min-w-0 truncate text-xs text-muted-foreground">{user.email}</span>}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top">
        <DropdownMenuLabel className="max-w-56 truncate">{user.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild><Link href="/definicoes">Definições</Link></DropdownMenuItem>
        <DropdownMenuItem onSelect={logout}><LogOut /> Terminar sessão</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const w = useWedding();
  const sync = useRealtimeSync();
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const cd = countdown(w.wedding_date);
  const current = NAV.find((n) => isActive(pathname, n.href));
  const main = [NAV[0]!, NAV[1]!, NAV[3]!, NAV[4]!];

  return (
    <div className="min-h-dvh md:pl-16 lg:pl-64">
      {/* Barra lateral: ícones no tablet, completa no computador */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-16 flex-col border-r bg-card md:flex lg:w-64">
        <div className="flex h-16 items-center px-3 lg:px-5"><span className="lg:hidden"><Brand compact /></span><span className="hidden min-w-0 lg:block"><Brand /></span></div>
        <div className="flex-1 overflow-y-auto px-2 py-2 lg:px-3">
          <div className="lg:hidden"><NavLinks rail /></div>
          <div className="hidden lg:block"><NavLinks /></div>
        </div>
        <div className="border-t p-2"><div className="lg:hidden"><UserMenu compact /></div><div className="hidden lg:block"><UserMenu /></div></div>
      </aside>

      {/* Barra superior */}
      <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-background/90 px-3 backdrop-blur sm:px-5 md:h-16">
        <Button variant="ghost" size="icon-sm" className="md:hidden" onClick={() => setMenuOpen(true)} aria-label="Abrir menu"><Menu /></Button>
        <div className="min-w-0 md:hidden"><p className="truncate font-serif text-lg font-semibold text-sage-900">{current?.label ?? w.name}</p></div>
        <button onClick={() => setSearchOpen(true)} className="ml-auto flex h-9 items-center gap-2 rounded-md border bg-card px-3 text-sm text-muted-foreground transition-colors hover:bg-secondary md:ml-0 md:w-72 lg:w-96" aria-label="Pesquisa global">
          <Search className="size-4" /><span className="hidden md:inline">Pesquisar em tudo…</span>
          <kbd className="ml-auto hidden rounded border bg-secondary px-1.5 text-[10px] font-medium lg:inline">Ctrl K</kbd>
        </button>
        <div className="ml-auto hidden items-center gap-3 md:flex">
          <Link href="/" className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground" title={`Casamento a ${w.wedding_date}`}>{cd.label}</Link>
          <Tooltip>
            <TooltipTrigger asChild><span className={cn("flex items-center gap-1 text-xs", sync === "live" ? "text-sage-600" : "text-muted-foreground")}>{sync === "offline" ? <WifiOff className="size-4" /> : <Wifi className="size-4" />}</span></TooltipTrigger>
            <TooltipContent>{sync === "live" ? "Atualização automática ativa: vê as alterações do seu par em tempo real." : sync === "offline" ? "Sem ligação em tempo real: os dados atualizam a cada 30 s." : "A ligar…"}</TooltipContent>
          </Tooltip>
        </div>
      </header>

      <main id="conteudo" className="mx-auto w-full max-w-7xl px-4 pt-5 pb-28 sm:px-6 md:pb-10 lg:px-8">{children}</main>

      {/* Menu inferior (telemóvel) */}
      <nav aria-label="Navegação rápida" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {main.map((n) => {
          const active = isActive(pathname, n.href);
          return (
            <Link key={n.href} href={n.href} aria-current={active ? "page" : undefined} className={cn("flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium", active ? "text-sage-700" : "text-muted-foreground")}>
              <n.icon className={cn("size-5", active && "text-sage-600")} />{n.short}
            </Link>
          );
        })}
        <button onClick={() => setMenuOpen(true)} className="flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-muted-foreground"><MoreHorizontal className="size-5" />Mais</button>
      </nav>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left">
          <SheetHeader><SheetTitle>{w.name}</SheetTitle><SheetDescription>{w.partner1_name} &amp; {w.partner2_name} · {cd.label}</SheetDescription></SheetHeader>
          <div className="flex-1 overflow-y-auto px-3"><NavLinks onNavigate={() => setMenuOpen(false)} /></div>
          <div className="border-t p-3"><UserMenu /></div>
        </SheetContent>
      </Sheet>

      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}
