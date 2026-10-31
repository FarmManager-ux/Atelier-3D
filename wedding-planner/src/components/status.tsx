import { Badge } from "@/components/ui/badge";
import type { InvitationStatus, PaymentStatus, RsvpStatus, TaskPriority, TaskStatus, VendorStatus } from "@/lib/db-types";
import { invitationStatusLabel, paymentStatusLabel, rsvpStatusLabel, taskPriorityLabel, taskStatusLabel, vendorStatusLabel } from "@/lib/labels";

export const InvitationBadge = ({ status }: { status: InvitationStatus }) => (
  <Badge variant={status === "por_convidar" ? "neutral" : status === "recusado" ? "danger" : status === "entregue" ? "success" : "default"}>{invitationStatusLabel[status]}</Badge>
);
export const RsvpBadge = ({ status }: { status: RsvpStatus }) => (
  <Badge variant={status === "confirmado" ? "success" : status === "nao_vai" ? "danger" : "warning"}>{rsvpStatusLabel[status]}</Badge>
);
export const PaymentBadge = ({ status }: { status: PaymentStatus }) => (
  <Badge variant={status === "pago" ? "success" : status === "parcial" ? "warning" : "neutral"}>{paymentStatusLabel[status]}</Badge>
);
export const TaskStatusBadge = ({ status }: { status: TaskStatus }) => (
  <Badge variant={status === "concluida" ? "success" : status === "em_andamento" ? "gold" : "neutral"}>{taskStatusLabel[status]}</Badge>
);
export const PriorityBadge = ({ priority }: { priority: TaskPriority }) => (
  <Badge variant={priority === "alta" ? "danger" : priority === "media" ? "warning" : "outline"}>{taskPriorityLabel[priority]}</Badge>
);
export const VendorBadge = ({ status }: { status: VendorStatus }) => (
  <Badge variant={status === "contratado" ? "success" : status === "recusado" ? "danger" : status === "por_contactar" ? "neutral" : "gold"}>{vendorStatusLabel[status]}</Badge>
);
