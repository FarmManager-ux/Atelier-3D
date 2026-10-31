import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function PageHeader({ title, description, actions, className }: { title: string; description?: React.ReactNode; actions?: React.ReactNode; className?: string }) {
  return (
    <header className={cn("mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        <h1 className="font-serif text-3xl leading-tight font-semibold text-sage-900 sm:text-4xl">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** Estado vazio informativo, com a próxima ação sugerida. */
export function EmptyState({ icon: Icon, title, description, action, className }: { icon: LucideIcon; title: string; description?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-card/60 px-6 py-12 text-center", className)}>
      <span className="grid size-12 place-items-center rounded-full bg-accent text-gold-600"><Icon className="size-5" /></span>
      <div>
        <p className="font-serif text-xl font-semibold text-sage-900">{title}</p>
        {description && <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/** Indicador compacto: valor em destaque, rótulo e uma nota opcional. */
export function Stat({ label, value, hint, icon: Icon, tone = "default", className }: { label: string; value: React.ReactNode; hint?: React.ReactNode; icon?: LucideIcon; tone?: "default" | "gold" | "warning"; className?: string }) {
  return (
    <Card className={cn("gap-1 py-3.5", className)}>
      <div className="flex items-center justify-between gap-2 px-4">
        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</span>
        {Icon && <Icon className={cn("size-4", tone === "gold" ? "text-gold" : tone === "warning" ? "text-warning" : "text-sage-400")} />}
      </div>
      <div className="px-4 font-serif text-3xl leading-none font-semibold text-sage-900 tabular-nums">{value}</div>
      {hint && <div className="px-4 text-xs text-muted-foreground">{hint}</div>}
    </Card>
  );
}

export function SkeletonCards({ n = 4, className }: { n?: number; className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 gap-3 lg:grid-cols-4", className)} role="status" aria-label="A carregar">
      {Array.from({ length: n }, (_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
    </div>
  );
}

export function SkeletonRows({ n = 6, className }: { n?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)} role="status" aria-label="A carregar">
      {Array.from({ length: n }, (_, i) => <Skeleton key={i} className="h-12 w-full" />)}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border border-[#e2b8b1] bg-[#fbf1ef] px-6 py-10 text-center">
      <p className="font-serif text-xl font-semibold text-[#8a3b32]">Não foi possível carregar os dados</p>
      <p className="max-w-md text-sm text-[#8a3b32]/80">{message ?? "Verifique a ligação à internet e tente novamente."}</p>
      {onRetry && <button onClick={onRetry} className="rounded-md border border-[#c98c83] bg-card px-4 py-2 text-sm font-medium text-[#8a3b32] hover:bg-secondary">Tentar novamente</button>}
    </div>
  );
}
