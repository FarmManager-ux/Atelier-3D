/** Tipos das linhas da base de dados (espelham supabase/migrations). */
export type MemberRole = "owner" | "member";
export type GuestSide = "partner1" | "partner2" | "both";
export type GuestCategory = "familia" | "amigos" | "trabalho" | "outros";
export type AgeGroup = "adulto" | "crianca";
export type InvitationStatus = "por_convidar" | "enviado" | "entregue" | "recusado";
export type RsvpStatus = "sem_resposta" | "confirmado" | "nao_vai";
export type TableShape = "redonda" | "retangular" | "quadrada";
export type PaymentStatus = "por_pagar" | "parcial" | "pago";
export type TaskStatus = "por_iniciar" | "em_andamento" | "concluida";
export type TaskPriority = "baixa" | "media" | "alta";
export type TaskAssignee = "partner1" | "partner2" | "both" | "other";
export type VendorStatus = "por_contactar" | "contactado" | "orcamento_recebido" | "em_negociacao" | "contratado" | "recusado";
export type DocumentCategory = "contrato" | "orcamento" | "fatura" | "comprovativo" | "inspiracao" | "outro";
export type EventType = "pagamento" | "reuniao" | "prazo" | "tarefa" | "prova_roupa" | "contacto_fornecedor" | "data_importante" | "outro";
export type ContactChannel = "whatsapp" | "email" | "mao" | "correio" | "outro";

export interface Wedding {
  id: string;
  name: string;
  partner1_name: string;
  partner2_name: string;
  wedding_date: string; // yyyy-MM-dd
  venue_name: string | null;
  total_budget: number;
  preferences: Record<string, unknown>;
  created_at: string;
}

export interface WeddingMember { wedding_id: string; user_id: string; role: MemberRole; email: string | null; created_at: string }
export interface WeddingInvitation { id: string; wedding_id: string; email: string; invited_by: string | null; created_at: string; accepted_at: string | null }
export interface GuestGroup { id: string; wedding_id: string; name: string; notes: string | null; created_at: string }

export interface Guest {
  id: string;
  wedding_id: string;
  group_id: string | null;
  full_name: string;
  surname: string | null;
  phone: string | null;
  email: string | null;
  relationship: string | null;
  side: GuestSide;
  category: GuestCategory;
  age_group: AgeGroup;
  companion_names: string | null;
  companions_count: number;
  children_count: number;
  dietary_restrictions: string | null;
  allergies: string | null;
  notes: string | null;
  invitation_status: InvitationStatus;
  rsvp_status: RsvpStatus;
  attending_companions: number | null;
  attending_children: number | null;
  invited_count: number;
  expected_count: number;
  created_at: string;
  updated_at: string;
}

export interface Invitation {
  id: string;
  wedding_id: string;
  guest_id: string;
  token: string;
  rsvp_enabled: boolean;
  channel: ContactChannel | null;
  sent_at: string | null;
  delivered_at: string | null;
  responded_at: string | null;
  last_contacted_at: string | null;
  notes: string | null;
}

export interface RsvpResponse {
  id: string;
  wedding_id: string;
  guest_id: string;
  status: Exclude<RsvpStatus, "sem_resposta">;
  companions_attending: number;
  children_attending: number;
  dietary_restrictions: string | null;
  allergies: string | null;
  message: string | null;
  source: "link" | "manual";
  submitted_at: string;
}

export interface TableRow {
  id: string;
  wedding_id: string;
  name: string;
  shape: TableShape;
  capacity: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  notes: string | null;
}

export interface TableSeat { id: string; table_id: string; wedding_id: string; seat_number: number }
export interface GuestSeating { id: string; wedding_id: string; guest_id: string; table_id: string; seat_id: string; person_index: number }
export interface BudgetCategory { id: string; wedding_id: string; name: string; planned_budget: number; sort_order: number }

export interface Vendor {
  id: string;
  wedding_id: string;
  company_name: string;
  service_type: string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  quoted_amount: number | null;
  contracted_amount: number | null;
  status: VendorStatus;
  notes: string | null;
}

export interface Expense {
  id: string;
  wedding_id: string;
  category_id: string;
  vendor_id: string | null;
  description: string;
  planned_amount: number;
  paid_amount: number;
  payment_status: PaymentStatus;
  payment_date: string | null;
  due_date: string | null;
  notes: string | null;
}

export interface Task {
  id: string;
  wedding_id: string;
  title: string;
  description: string | null;
  category: string | null;
  assignee: TaskAssignee;
  assignee_other: string | null;
  due_date: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  completed_at: string | null;
}

export interface DocumentRow {
  id: string;
  wedding_id: string;
  name: string;
  category: DocumentCategory;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number;
  vendor_id: string | null;
  notes: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface CalendarEvent {
  id: string;
  wedding_id: string;
  title: string;
  event_type: EventType;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  notes: string | null;
  vendor_id: string | null;
}
