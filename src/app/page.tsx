import { common } from "@/shared/i18n/pt-PT";

const PHASES = [
  { n: 0, name: "Fundação técnica", done: true },
  { n: 1, name: "Design system e site público", done: false },
  { n: 2, name: "Autenticação e área de clientes", done: false },
  { n: 3, name: "CRM e central de contactos", done: false },
  { n: 4, name: "Orçamentos e simulador FDM", done: false },
];

export default function Home() {
  return (
    <main className="layers mx-auto flex min-h-dvh max-w-3xl flex-col justify-between gap-16 px-5 py-10 sm:px-8">
      <header className="rise">
        <p className="font-display text-4xl font-bold uppercase tracking-wide sm:text-5xl">
          Atelier <span className="text-[var(--accent)]">3D</span>
        </p>
        <p className="mt-1 font-mono text-xs uppercase tracking-[0.25em] text-[var(--text-muted)]">Impressão 3D FDM · Portugal</p>
      </header>

      <section className="rise flex flex-col gap-6" style={{ animationDelay: "80ms" }}>
        <h1 className="font-display text-5xl font-bold uppercase leading-[0.95] sm:text-7xl">
          Portal em
          <br />
          construção
        </h1>
        <p className="max-w-prose text-lg text-[var(--text-muted)]">
          A plataforma de gestão do Atelier 3D está a ser construída por fases. Esta página só confirma que a
          fundação técnica está de pé.
        </p>
        <ol className="flex flex-col divide-y divide-[var(--line)] border-y border-[var(--line)] font-mono text-sm">
          {PHASES.map((p) => (
            <li key={p.n} className="flex items-center justify-between gap-4 py-3">
              <span className="min-w-0">
                <span className="text-[var(--text-muted)]">F{p.n}</span>
                <span className="ml-3">{p.name}</span>
              </span>
              <span className={`shrink-0 whitespace-nowrap ${p.done ? "text-[var(--accent)]" : "text-[var(--text-muted)]"}`}>{p.done ? "em validação" : "por fazer"}</span>
            </li>
          ))}
        </ol>
      </section>

      <footer className="font-mono text-xs text-[var(--text-muted)]">{common.domain}</footer>
    </main>
  );
}
