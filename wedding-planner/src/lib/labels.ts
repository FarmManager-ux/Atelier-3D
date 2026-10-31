import type {
  AgeGroup, ContactChannel, DocumentCategory, EventType, GuestCategory, GuestSide, InvitationStatus, PaymentStatus,
  RsvpStatus, TableShape, TaskPriority, TaskStatus, VendorStatus, Wedding,
} from "./db-types";

/** Textos da interface em português de Portugal. */
export const invitationStatusLabel: Record<InvitationStatus, string> = {
  por_convidar: "Por convidar",
  enviado: "Convite enviado",
  entregue: "Convite entregue",
  recusado: "Convite recusado",
};
export const rsvpStatusLabel: Record<RsvpStatus, string> = {
  sem_resposta: "Sem resposta",
  confirmado: "Confirmado",
  nao_vai: "Não vai comparecer",
};
export const categoryLabel: Record<GuestCategory, string> = { familia: "Família", amigos: "Amigos", trabalho: "Trabalho", outros: "Outros" };
export const ageGroupLabel: Record<AgeGroup, string> = { adulto: "Adulto", crianca: "Criança" };
export const shapeLabel: Record<TableShape, string> = { redonda: "Redonda", retangular: "Retangular", quadrada: "Quadrada" };
export const paymentStatusLabel: Record<PaymentStatus, string> = { por_pagar: "Por pagar", parcial: "Parcialmente pago", pago: "Pago" };
export const taskStatusLabel: Record<TaskStatus, string> = { por_iniciar: "Por iniciar", em_andamento: "Em andamento", concluida: "Concluída" };
export const taskPriorityLabel: Record<TaskPriority, string> = { baixa: "Baixa", media: "Média", alta: "Alta" };
export const vendorStatusLabel: Record<VendorStatus, string> = {
  por_contactar: "Por contactar", contactado: "Contactado", orcamento_recebido: "Orçamento recebido",
  em_negociacao: "Em negociação", contratado: "Contratado", recusado: "Recusado",
};
export const documentCategoryLabel: Record<DocumentCategory, string> = {
  contrato: "Contratos", orcamento: "Orçamentos", fatura: "Faturas", comprovativo: "Comprovativos", inspiracao: "Fotografias de inspiração", outro: "Outros documentos",
};
export const eventTypeLabel: Record<EventType, string> = {
  pagamento: "Pagamento", reuniao: "Reunião", prazo: "Prazo", tarefa: "Tarefa", prova_roupa: "Prova de roupa",
  contacto_fornecedor: "Contacto com fornecedor", data_importante: "Data importante", outro: "Outro",
};
export const channelLabel: Record<ContactChannel, string> = { whatsapp: "WhatsApp", email: "Email", mao: "Em mão", correio: "Correio", outro: "Outro" };

export const sideLabel = (side: GuestSide, w: Pick<Wedding, "partner1_name" | "partner2_name">): string =>
  side === "partner1" ? w.partner1_name : side === "partner2" ? w.partner2_name : "Ambos";

export const entries = <K extends string>(labels: Record<K, string>) => (Object.keys(labels) as K[]).map((value) => ({ value, label: labels[value] }));

export const TASK_CATEGORIES = ["Planeamento", "Espaço", "Convidados", "Fornecedores", "Roupa", "Cerimónia", "Festa", "Lua de mel", "Outros"] as const;
