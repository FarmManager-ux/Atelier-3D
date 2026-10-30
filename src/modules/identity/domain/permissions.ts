/**
 * Catálogo de permissões da equipa do Atelier 3D (RBAC).
 * Fonte única de verdade: a seed SQL é gerada a partir daqui (scripts/gen-rbac-seed.ts)
 * e o teste tests/db/rbac.test.ts garante que a base de dados coincide.
 * Formato da chave: "<módulo>.<ação>" ou "<módulo>.<recurso>.<ação>".
 */
export const PERMISSIONS = {
  "customers.read": "Ver clientes e contas",
  "customers.write": "Criar e editar clientes",
  "customers.billing.read": "Ver dados de faturação dos clientes",
  "customers.billing.write": "Editar dados de faturação dos clientes",
  "crm.read": "Ver contactos e interações (CRM)",
  "crm.write": "Registar e editar contactos e interações",
  "quotes.read": "Ver orçamentos",
  "quotes.write": "Criar e editar orçamentos",
  "quotes.approve": "Aprovar e enviar orçamentos",
  "estimator.configure": "Configurar o simulador FDM e as regras de preço",
  "modeling.read": "Ver trabalhos de modelação 3D",
  "modeling.write": "Gerir trabalhos de modelação 3D",
  "orders.read": "Ver encomendas",
  "orders.write": "Gerir encomendas",
  "documents.read": "Ver documentos",
  "documents.write": "Carregar e gerir documentos",
  "production.read": "Ver trabalhos de produção",
  "production.write": "Planear e gerir a produção",
  "printers.read": "Ver impressoras",
  "printers.write": "Gerir impressoras e manutenção",
  "materials.read": "Ver materiais e bobines",
  "materials.write": "Gerir materiais, bobines e consumos",
  "inventory.read": "Ver stock e peças",
  "inventory.write": "Gerir stock e peças",
  "finance.read": "Ver dados financeiros",
  "finance.write": "Registar custos, valores recebidos e faturação",
  "reports.read": "Ver relatórios e indicadores",
  "automations.manage": "Gerir automatizações",
  "content.manage": "Gerir conteúdos do site público (portefólio, FAQ, serviços)",
  "messages.read": "Ver mensagens com clientes",
  "messages.write": "Responder a clientes",
  "audit.read": "Consultar o registo de auditoria",
  "staff.manage": "Gerir a equipa e as funções",
  "settings.manage": "Gerir as definições da plataforma",
} as const;

export type Permission = keyof typeof PERMISSIONS;
export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

export function isPermission(value: string): value is Permission {
  return Object.hasOwn(PERMISSIONS, value);
}
