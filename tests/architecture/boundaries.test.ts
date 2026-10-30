import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { checkFile, importsOf } from "./rules";

const ROOT = join(import.meta.dirname, "..", "..");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
  });
}

describe("arquitetura do código real", () => {
  const files = walk(join(ROOT, "src"));
  it("analisa ficheiros (o teste não é vazio)", () => expect(files.length).toBeGreaterThan(10));
  it("não há violações das regras de fronteiras e segurança", () => {
    const violations = files.flatMap((f) => checkFile(relative(ROOT, f), readFileSync(f, "utf8")));
    expect(violations).toEqual([]);
  });
});

describe("as regras detetam violações (auto-teste)", () => {
  const rules = (file: string, src: string) => checkFile(file, src).map((v) => v.rule);
  it("R1: import interno de outro módulo", () => {
    expect(rules("src/modules/crm/a.ts", `import { x } from "@/modules/identity/domain/roles";`)).toContain("R1-api-publica");
    expect(rules("src/modules/crm/a.ts", `import { x } from "@/modules/identity";`)).toEqual([]);
    expect(rules("src/modules/crm/a.ts", `import { x } from "@/modules/crm/domain/y";`)).toEqual([]);
  });
  it("R2: domínio impuro", () => {
    expect(rules("src/modules/crm/domain/a.ts", `import { createClient } from "@supabase/supabase-js";`)).toContain("R2-dominio-puro");
    expect(rules("src/modules/crm/domain/a.ts", `import React from "react";`)).toContain("R2-dominio-puro");
    expect(rules("src/modules/crm/domain/a.ts", `import { z } from "zod";`)).toEqual([]);
  });
  it("R3: shared depende de módulos", () => {
    expect(rules("src/shared/a.ts", `import x from "@/modules/crm";`)).toContain("R3-shared-independente");
  });
  it("R4: chave de serviço em sítio não autorizado", () => {
    expect(rules("src/app/page.tsx", `import { createAdminClient } from "@/shared/supabase/admin";`)).toContain("R4-service-role-so-no-servidor");
    expect(rules("src/modules/crm/server/a.ts", `import { createAdminClient } from "@/shared/supabase/admin";`)).toEqual([]);
    expect(rules("src/app/api/x/route.ts", `import { createAdminClient } from "@/shared/supabase/admin";`)).toEqual([]);
  });
  it("R5: ficheiro de cliente a importar código de servidor", () => {
    expect(rules("src/app/x.tsx", `"use client";\nimport { createClient } from "@/shared/supabase/server";`)).toContain("R5-cliente-sem-servidor");
    expect(rules("src/app/x.tsx", `import { createClient } from "@/shared/supabase/server";`)).not.toContain("R5-cliente-sem-servidor");
  });
  it("R6/R7: segredos", () => {
    expect(rules("src/app/x.ts", `const k = process.env.SUPABASE_SERVICE_ROLE_KEY;`)).toContain("R6-service-role-referencia");
    expect(rules("src/shared/supabase/admin.ts", `const k = process.env.SUPABASE_SERVICE_ROLE_KEY;`)).toEqual([]);
    expect(rules("src/app/x.ts", `process.env.NEXT_PUBLIC_SERVICE_KEY`)).toContain("R7-segredo-publico");
  });
  it("importsOf reconhece import, export from e import dinâmico", () => {
    expect(importsOf(`import a from "x";\nexport { b } from "y";\nconst c = import("z");\nimport "w";`)).toEqual(["x", "y", "z", "w"]);
  });
});
