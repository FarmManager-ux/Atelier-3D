import type { Guest } from "../db-types";

let n = 0;
export const guest = (o: Partial<Guest> = {}): Guest => {
  const companions = o.companions_count ?? 0, children = o.children_count ?? 0;
  const invited = 1 + companions + children;
  const rsvp = o.rsvp_status ?? "sem_resposta";
  const expected = rsvp === "nao_vai" ? 0 : rsvp === "confirmado"
    ? 1 + Math.min(o.attending_companions ?? companions, companions) + Math.min(o.attending_children ?? children, children) : invited;
  return {
    id: `g${++n}`, wedding_id: "w", group_id: null, full_name: `Convidado ${n}`, surname: null, phone: null, email: null, relationship: null,
    side: "both", category: "outros", age_group: "adulto", companion_names: null, companions_count: companions, children_count: children,
    dietary_restrictions: null, allergies: null, notes: null, invitation_status: "por_convidar", rsvp_status: rsvp,
    attending_companions: null, attending_children: null, invited_count: invited, expected_count: expected, created_at: "", updated_at: "", ...o,
  } as Guest;
};
