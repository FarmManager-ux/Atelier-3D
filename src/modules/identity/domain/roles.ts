import { ALL_PERMISSIONS, type Permission } from "./permissions";

export type StaffRole = "admin" | "manager" | "sales" | "production" | "finance" | "modeler";

type RoleDef = { label: string; permissions: readonly Permission[] };

/** Matriz função → permissões. O "admin" tem sempre todas (inclui as que forem criadas no futuro). */
export const ROLES: Record<StaffRole, RoleDef> = {
  admin: { label: "Administrador", permissions: ALL_PERMISSIONS },
  manager: {
    label: "Gestor",
    permissions: [
      "customers.read", "customers.write", "customers.billing.read",
      "crm.read", "crm.write", "quotes.read", "quotes.write", "quotes.approve", "estimator.configure",
      "modeling.read", "modeling.write", "orders.read", "orders.write",
      "documents.read", "documents.write", "production.read", "production.write",
      "printers.read", "printers.write", "materials.read", "materials.write",
      "inventory.read", "inventory.write", "finance.read", "reports.read",
      "content.manage", "messages.read", "messages.write", "audit.read",
    ],
  },
  sales: {
    label: "Comercial",
    permissions: [
      "customers.read", "customers.write", "crm.read", "crm.write", "quotes.read", "quotes.write",
      "orders.read", "documents.read", "messages.read", "messages.write",
    ],
  },
  production: {
    label: "Produção",
    permissions: [
      "production.read", "production.write", "printers.read", "printers.write",
      "materials.read", "materials.write", "inventory.read", "inventory.write",
      "orders.read", "quotes.read", "documents.read",
    ],
  },
  finance: {
    label: "Financeiro",
    permissions: [
      "finance.read", "finance.write", "reports.read", "customers.read",
      "customers.billing.read", "customers.billing.write", "orders.read", "quotes.read", "documents.read",
    ],
  },
  modeler: {
    label: "Modelação 3D",
    permissions: [
      "modeling.read", "modeling.write", "documents.read", "documents.write",
      "customers.read", "quotes.read", "orders.read", "messages.read", "messages.write",
    ],
  },
};

export const STAFF_ROLES = Object.keys(ROLES) as StaffRole[];

export function roleHas(role: StaffRole, permission: Permission): boolean {
  return ROLES[role].permissions.includes(permission);
}
