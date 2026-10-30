/** Regras de arquitetura (fronteiras entre módulos e segurança). Funções puras, testáveis. */
export type Violation = { file: string; rule: string; detail: string };

const IMPORT_RE = /(?:import|export)\s[^'"]*?from\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|^\s*import\s+['"]([^'"]+)['"]/gm;

export function importsOf(source: string): string[] {
  const out: string[] = [];
  for (const m of source.matchAll(IMPORT_RE)) out.push((m[1] ?? m[2] ?? m[3])!);
  return out;
}

const isClientFile = (src: string) => /^\s*(?:\/\*[\s\S]*?\*\/\s*|\/\/.*\n\s*)*['"]use client['"]/.test(src);

export function checkFile(file: string, source: string): Violation[] {
  const v: Violation[] = [];
  const imports = importsOf(source);
  const add = (rule: string, detail: string) => v.push({ file, rule, detail });
  const mod = /^src\/modules\/([^/]+)\//.exec(file)?.[1];
  const inShared = file.startsWith("src/shared/");
  const inDomain = /^src\/modules\/[^/]+\/domain\//.test(file);
  const isTest = /\.test\.tsx?$/.test(file);

  for (const imp of imports) {
    // R1: um módulo só usa outro módulo pela API pública (index), nunca por caminhos internos.
    const other = /^@\/modules\/([^/]+)(\/.*)?$/.exec(imp);
    if (mod && other && other[1] !== mod && other[2]) add("R1-api-publica", `${imp} (usar @/modules/${other[1]})`);
    // R1b: módulos não dependem da camada de rotas.
    if (mod && imp.startsWith("@/app/")) add("R1-sem-app", imp);
    // R2: o domínio é puro (sem React, Next, Supabase nem server-only).
    if (inDomain && !isTest && /^(react|react-dom|next|server-only|@supabase\/)/.test(imp)) add("R2-dominio-puro", imp);
    if (inDomain && !isTest && /^@\/shared\/supabase\//.test(imp)) add("R2-dominio-puro", imp);
    // R3: shared não depende de módulos nem de rotas.
    if (inShared && /^@\/(modules|app)\//.test(imp)) add("R3-shared-independente", imp);
    // R4: a chave de serviço (admin client) só no servidor, em sítios autorizados.
    if (/^@\/shared\/supabase\/admin$/.test(imp)) {
      const allowed = /^src\/modules\/[^/]+\/server\//.test(file) || /^src\/app\/api\//.test(file) ||
        /\/(actions|route)\.ts$/.test(file) || isTest;
      if (!allowed) add("R4-service-role-so-no-servidor", file);
    }
    // R5: ficheiros de cliente nunca importam código de servidor.
    if (isClientFile(source) && /^@\/shared\/supabase\/(admin|server)$/.test(imp)) add("R5-cliente-sem-servidor", imp);
    if (isClientFile(source) && imp === "server-only") add("R5-cliente-sem-servidor", imp);
  }

  // R6: a chave de serviço só é referenciada no cliente admin e na configuração.
  if (/SUPABASE_SERVICE_ROLE/.test(source) && !/^src\/shared\/(supabase\/admin|config\/env)\.ts$/.test(file) && !isTest) {
    add("R6-service-role-referencia", file);
  }
  // R7: nunca expor segredos com NEXT_PUBLIC_.
  if (/NEXT_PUBLIC_[A-Z_]*(SERVICE|SECRET|PRIVATE|PASSWORD|TOKEN)/.test(source) && !isTest) add("R7-segredo-publico", file);
  return v;
}
