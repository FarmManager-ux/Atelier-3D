// Gera a seed SQL de permissões e funções a partir de src/modules/identity.
// Uso: pnpm exec tsx scripts/gen-rbac-seed.ts
import { PERMISSIONS } from "../src/modules/identity/domain/permissions";
import { ROLES, STAFF_ROLES } from "../src/modules/identity/domain/roles";

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const out: string[] = [];
out.push("insert into public.permissions (key, description) values");
out.push(Object.entries(PERMISSIONS).map(([k, d]) => `  (${q(k)}, ${q(d)})`).join(",\n") + ";");
out.push("");
out.push("insert into public.staff_roles (key, label, is_system) values");
out.push(STAFF_ROLES.map((r) => `  (${q(r)}, ${q(ROLES[r].label)}, true)`).join(",\n") + ";");
out.push("");
out.push("insert into public.role_permissions (role_key, permission_key) values");
const rows: string[] = [];
for (const r of STAFF_ROLES) for (const p of ROLES[r].permissions) rows.push(`  (${q(r)}, ${q(p)})`);
out.push(rows.join(",\n") + ";");
console.log(out.join("\n"));
