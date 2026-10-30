/** API pública do módulo "identity" (autenticação, contas de clientes, equipa e permissões). */
export { PERMISSIONS, ALL_PERMISSIONS, isPermission, type Permission } from "./domain/permissions";
export { ROLES, STAFF_ROLES, roleHas, type StaffRole } from "./domain/roles";
