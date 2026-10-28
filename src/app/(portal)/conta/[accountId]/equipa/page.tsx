import type { Metadata } from "next";
import { changeMemberRole, inviteMember, removeMember, revokeInvitation } from "@/app/(portal)/actions";
import { ActionForm, Field, SelectField } from "@/components/form";
import { Card, SmallButton } from "@/components/ui";
import { loadAccount } from "@/lib/action-helpers";
import { messages } from "@/lib/i18n/pt-PT";

export const metadata: Metadata = { title: messages.team.title };
const t = messages.team;

export default async function TeamPage({ params }: { params: Promise<{ accountId: string }> }) {
  const { accountId } = await params;
  const { supabase, account, user, role, canManage, isOwner } = await loadAccount(accountId);
  const [{ data: members }, { data: invitations }] = await Promise.all([
    supabase.from("account_members").select("user_id, role, created_at").eq("account_id", account.id).order("created_at"),
    canManage
      ? supabase.from("account_invitations").select("id, email, role, expires_at").eq("account_id", account.id).is("accepted_at", null).gt("expires_at", new Date().toISOString())
      : Promise.resolve({ data: [] as { id: string; email: string; role: string; expires_at: string }[] }),
  ]);
  const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", (members ?? []).map((m) => m.user_id));
  const nameOf = (id: string) => profiles?.find((p) => p.id === id)?.full_name || "—";
  const roleLabel = { owner: t.owner, admin: t.admin, member: t.member } as const;

  if (account.type === "individual") {
    return <Card><p>{t.individualOnly}</p></Card>;
  }
  return (
    <>
      <h2 className="text-xl font-semibold">{t.members}</h2>
      <ul className="flex flex-col gap-3">
        {members?.map((m) => {
          const editable = m.user_id !== user.id && (isOwner || (role === "admin" && m.role !== "owner"));
          return (
            <li key={m.user_id}>
              <Card className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{nameOf(m.user_id)}{m.user_id === user.id ? " (eu)" : ""}</p>
                  <p className="text-sm text-[var(--muted)]">{roleLabel[m.role as keyof typeof roleLabel]}</p>
                </div>
                {editable && m.role !== "owner" && (
                  <div className="flex flex-wrap gap-2">
                    <form action={changeMemberRole} className="flex gap-2">
                      <input type="hidden" name="accountId" value={account.id} />
                      <input type="hidden" name="userId" value={m.user_id} />
                      <select name="role" defaultValue={m.role} aria-label={t.role} className="min-h-11 rounded-md border border-[var(--border)] bg-transparent px-2 text-sm">
                        {isOwner && <option value="admin">{t.admin}</option>}
                        <option value="member">{t.member}</option>
                      </select>
                      <SmallButton>{messages.profileForms.save}</SmallButton>
                    </form>
                    <form action={removeMember}>
                      <input type="hidden" name="accountId" value={account.id} />
                      <input type="hidden" name="userId" value={m.user_id} />
                      <SmallButton danger>{t.leave}</SmallButton>
                    </form>
                  </div>
                )}
              </Card>
            </li>
          );
        })}
      </ul>

      {canManage && !!invitations?.length && (
        <>
          <h2 className="text-xl font-semibold">{t.pending}</h2>
          <ul className="flex flex-col gap-3">
            {invitations.map((i) => (
              <li key={i.id}>
                <Card className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0 text-sm">
                    <p className="break-all font-medium">{i.email}</p>
                    <p className="text-[var(--muted)]">{roleLabel[i.role as keyof typeof roleLabel]} · {t.expires} {new Date(i.expires_at).toLocaleDateString("pt-PT")}</p>
                  </div>
                  <form action={revokeInvitation}>
                    <input type="hidden" name="accountId" value={account.id} />
                    <input type="hidden" name="id" value={i.id} />
                    <SmallButton danger>{t.revoke}</SmallButton>
                  </form>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}

      {canManage && (
        <Card>
          <h3 className="mb-3 text-lg font-medium">{t.invite}</h3>
          <ActionForm action={inviteMember} submitLabel={t.inviteSubmit} hidden={{ accountId: account.id }}>
            <Field label={messages.book.email} name="email" type="email" autoComplete="off" />
            <SelectField label={t.role} name="role" defaultValue="member"
              options={[{ value: "member", label: t.member }, ...(isOwner ? [{ value: "admin", label: t.admin }] : [])]} />
          </ActionForm>
        </Card>
      )}
    </>
  );
}
