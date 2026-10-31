"use client";

import { Armchair } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/page";
import { Button } from "@/components/ui/button";
import type { SeatingView } from "@/lib/domain/seating";
import { TableDetails, type TableActions } from "./table-panel";
import { UnseatedPanel } from "./unseated-panel";
import { cn } from "@/lib/utils";

/** Vista alternativa em lista: o mesmo trabalho da planta, sem arrastar. */
export function TablesListView({ view, actions, onCreate, selectedId }: { view: SeatingView; actions: TableActions & { assign: (g: import("@/lib/db-types").Guest, t: string) => unknown }; onCreate: () => void; selectedId: string | null }) {
  if (view.tables.length === 0) {
    return <EmptyState icon={Armchair} title="Ainda não há mesas" description="Crie as mesas do banquete e defina a capacidade de cada uma. Depois distribua os convidados." action={<Button onClick={onCreate}>Criar a primeira mesa</Button>} />;
  }
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
      <div className="grid content-start gap-3 md:grid-cols-2">
        {view.tables.map((s) => (
          <Card key={s.table.id} className={cn("gap-3", selectedId === s.table.id && "ring-2 ring-sage-300", s.full && "border-gold/60")}>
            <CardContent>
              <div className="mb-1 flex justify-end">{s.full && <Badge variant="gold">Mesa cheia</Badge>}</div>
              <TableDetails state={s} view={view} actions={actions} draggable={false} className="-mt-5" />
            </CardContent>
          </Card>
        ))}
      </div>
      <UnseatedPanel view={view} onAssign={(g, t) => actions.assign(g, t)} className="lg:sticky lg:top-20 lg:max-h-[calc(100dvh-7rem)]" />
    </div>
  );
}
