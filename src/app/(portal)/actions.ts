"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { formObject, loadAccount, requireUser } from "@/lib/action-helpers";
import { friendlyDbError } from "@/lib/db-errors";
import { messages } from "@/lib/i18n/pt-PT";
import { sanitizeFilename, checkFile } from "@/lib/files/rules";
import { FILES_BUCKET, supabaseFinalizeDeps } from "@/lib/files/supabase-deps";
import { finalizeUpload } from "@/lib/files/finalize";
import { fieldErrors, type FieldErrors } from "@/lib/validation/auth";
import {
  accountDetailsSchema, addressSchema, contactSchema, fiscalSchema, inviteSchema,
  prepareUploadSchema, projectSchema, userProfileSchema, uuidSchema,
} from "@/lib/validation/profile";

export type ActionState = { errors?: FieldErrors; message?: string; ok?: boolean; link?: string };

const saved: ActionState = { ok: true, message: messages.db.saved };
const dbFail = (e: { code?: string; message?: string }): ActionState => ({ message: friendlyDbError(e) });
const idOf = (fd: FormData, k: string) => {
  const r = uuidSchema.safeParse(String(fd.get(k) ?? ""));
  return r.success ? r.data : null;
};

// ------------------------------------------------------------ perfil do utilizador
export async function updateUserProfile(_: ActionState, fd: FormData): Promise<ActionState> {
  const p = userProfileSchema.safeParse(formObject(fd));
  if (!p.success) return { errors: fieldErrors(p.error) };
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: p.data.fullName, phone: p.data.phone ?? null })
    .eq("id", user.id);
  if (error) return dbFail(error);
  revalidatePath("/perfil");
  return saved;
}

// -------------------------------------------------------------------- contas
export async function createCompanyAccount(_: ActionState, fd: FormData): Promise<ActionState> {
  const name = String(fd.get("displayName") ?? "").trim();
  if (name.length < 1 || name.length > 200) return { errors: { displayName: messages.validation.required } };
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("create_account", { p_type: "company", p_display_name: name });
  if (error) return dbFail(error);
  redirect(`/conta/${data}`);
}

export async function updateAccountDetails(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = idOf(fd, "accountId");
  const p = accountDetailsSchema.safeParse(formObject(fd));
  if (!id) return { message: messages.db.invalid };
  if (!p.success) return { errors: fieldErrors(p.error) };
  const { supabase, canManage } = await loadAccount(id);
  if (!canManage) return { message: messages.db.forbidden };
  const { error } = await supabase.from("accounts").update({
    display_name: p.data.displayName, phone: p.data.phone ?? null, website: p.data.website ?? null,
    billing_email: p.data.billingEmail ?? null, activity: p.data.activity ?? null,
  }).eq("id", id);
  if (error) return dbFail(error);
  revalidatePath(`/conta/${id}`, "layout");
  return saved;
}

export async function saveFiscalData(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = idOf(fd, "accountId");
  const p = fiscalSchema.safeParse(formObject(fd));
  if (!id) return { message: messages.db.invalid };
  if (!p.success) return { errors: fieldErrors(p.error) };
  const { supabase, canManage } = await loadAccount(id);
  if (!canManage) return { message: messages.db.forbidden };
  const { error } = await supabase.from("account_fiscal_data").upsert({
    account_id: id, legal_name: p.data.legalName ?? null, nif: p.data.nif ?? null, country: p.data.country,
  });
  if (error) return dbFail(error);
  revalidatePath(`/conta/${id}/perfil`);
  return saved;
}

// -------------------------------------------------------- moradas e contactos
export async function addAddress(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = idOf(fd, "accountId");
  const p = addressSchema.safeParse(formObject(fd));
  if (!id) return { message: messages.db.invalid };
  if (!p.success) return { errors: fieldErrors(p.error) };
  const { supabase, canManage } = await loadAccount(id);
  if (!canManage) return { message: messages.db.forbidden };
  const a = p.data;
  if (a.isDefault) {
    await supabase.from("account_addresses").update({ is_default: false }).eq("account_id", id).eq("kind", a.kind);
  }
  const { error } = await supabase.from("account_addresses").insert({
    account_id: id, kind: a.kind, label: a.label ?? null, recipient_name: a.recipientName, line1: a.line1,
    line2: a.line2 ?? null, postal_code: a.postalCode, city: a.city, region: a.region ?? null,
    country: a.country, phone: a.phone ?? null, is_default: a.isDefault,
  });
  if (error) return dbFail(error);
  revalidatePath(`/conta/${id}/moradas`);
  return { ok: true, message: messages.db.saved };
}

export async function deleteAddress(fd: FormData) {
  const id = idOf(fd, "accountId"), addr = idOf(fd, "id");
  if (!id || !addr) return;
  const { supabase, canManage } = await loadAccount(id);
  if (!canManage) return;
  await supabase.from("account_addresses").delete().eq("id", addr).eq("account_id", id);
  revalidatePath(`/conta/${id}/moradas`);
}

export async function addContact(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = idOf(fd, "accountId");
  const p = contactSchema.safeParse(formObject(fd));
  if (!id) return { message: messages.db.invalid };
  if (!p.success) return { errors: fieldErrors(p.error) };
  const { supabase, canManage } = await loadAccount(id);
  if (!canManage) return { message: messages.db.forbidden };
  const c = p.data;
  if (c.isPrimary) await supabase.from("account_contacts").update({ is_primary: false }).eq("account_id", id);
  const { error } = await supabase.from("account_contacts").insert({
    account_id: id, name: c.name, email: c.email ?? null, phone: c.phone ?? null,
    job_title: c.jobTitle ?? null, is_primary: c.isPrimary,
  });
  if (error) return dbFail(error);
  revalidatePath(`/conta/${id}/contactos`);
  return saved;
}

export async function deleteContact(fd: FormData) {
  const id = idOf(fd, "accountId"), cid = idOf(fd, "id");
  if (!id || !cid) return;
  const { supabase, canManage } = await loadAccount(id);
  if (!canManage) return;
  await supabase.from("account_contacts").delete().eq("id", cid).eq("account_id", id);
  revalidatePath(`/conta/${id}/contactos`);
}

// ------------------------------------------------------------------- equipa
export async function inviteMember(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = idOf(fd, "accountId");
  const p = inviteSchema.safeParse(formObject(fd));
  if (!id) return { message: messages.db.invalid };
  if (!p.success) return { errors: fieldErrors(p.error) };
  const { supabase } = await loadAccount(id);
  const { data, error } = await supabase.rpc("invite_member", { p_account: id, p_email: p.data.email, p_role: p.data.role });
  if (error) return dbFail(error);
  revalidatePath(`/conta/${id}/equipa`);
  // Sem envio de email nesta fase: o link é mostrado UMA vez a quem convida (o token não fica guardado em claro).
  return { ok: true, message: messages.team.inviteCreated, link: `/convite/${data}` };
}

export async function changeMemberRole(fd: FormData) {
  const id = idOf(fd, "accountId"), uid = idOf(fd, "userId");
  const role = String(fd.get("role"));
  if (!id || !uid || !["admin", "member"].includes(role)) return;
  const { supabase } = await loadAccount(id);
  await supabase.from("account_members").update({ role }).eq("account_id", id).eq("user_id", uid);
  revalidatePath(`/conta/${id}/equipa`);
}

export async function removeMember(fd: FormData) {
  const id = idOf(fd, "accountId"), uid = idOf(fd, "userId");
  if (!id || !uid) return;
  const { supabase } = await loadAccount(id);
  await supabase.from("account_members").delete().eq("account_id", id).eq("user_id", uid);
  revalidatePath(`/conta/${id}/equipa`);
}

export async function revokeInvitation(fd: FormData) {
  const id = idOf(fd, "accountId"), inv = idOf(fd, "id");
  if (!id || !inv) return;
  const { supabase } = await loadAccount(id);
  await supabase.from("account_invitations").delete().eq("id", inv).eq("account_id", id);
  revalidatePath(`/conta/${id}/equipa`);
}

export async function acceptInvitation(token: string): Promise<{ accountId?: string; message?: string }> {
  if (!/^[0-9a-f]{64}$/.test(token)) return { message: messages.team.inviteInvalid };
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("accept_invitation", { p_token: token });
  if (error) return { message: messages.team.inviteInvalid };
  return { accountId: data as string };
}

// ------------------------------------------------------------------ projetos
export async function createProject(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = idOf(fd, "accountId");
  const p = projectSchema.safeParse(formObject(fd));
  if (!id) return { message: messages.db.invalid };
  if (!p.success) return { errors: fieldErrors(p.error) };
  const { supabase, user } = await loadAccount(id);
  const { data, error } = await supabase.from("projects")
    .insert({ account_id: id, name: p.data.name, description: p.data.description ?? null, created_by: user.id })
    .select("id").single();
  if (error) return dbFail(error);
  redirect(`/conta/${id}/projetos/${data.id}`);
}

// ----------------------------------------------------------------- ficheiros
export type PrepareUploadResult =
  | { ok: true; versionId: string; path: string; token: string }
  | { ok: false; message: string };

/** 1/2 — valida, reserva a versão (pending) e devolve um URL de upload assinado para o Storage. */
export async function prepareUpload(input: unknown): Promise<PrepareUploadResult> {
  const p = prepareUploadSchema.safeParse(input);
  if (!p.success) return { ok: false, message: messages.db.invalid };
  const d = p.data;
  const filename = sanitizeFilename(d.filename);
  const check = checkFile(filename, d.size);
  if (!check.ok) return { ok: false, message: messages.files.errors[check.error] };

  const { supabase } = await loadAccount(d.accountId);
  const { data, error } = await supabase.rpc("begin_file_upload", {
    p_account: d.accountId, p_project: d.projectId, p_file: d.fileId, p_display_name: d.displayName,
    p_filename: filename, p_size: d.size, p_sha256: d.sha256, p_notes: d.notes ?? null,
  }).single<{ file_id: string; version_id: string; storage_path: string }>();
  if (error || !data) return { ok: false, message: friendlyDbError(error) };

  const signed = await supabase.storage.from(FILES_BUCKET).createSignedUploadUrl(data.storage_path);
  if (signed.error || !signed.data) {
    // A versão fica "pending" (invisível a terceiros); será limpa pela rotina de expiração (ver docs).
    return { ok: false, message: messages.db.generic };
  }
  return { ok: true, versionId: data.version_id, path: data.storage_path, token: signed.data.token };
}

/** 2/2 — o servidor verifica o objeto carregado (tamanho, SHA-256, formato) e só então o disponibiliza. */
export async function completeUpload(versionId: string): Promise<{ ok: boolean; message: string }> {
  if (!uuidSchema.safeParse(versionId).success) return { ok: false, message: messages.db.invalid };
  const { supabase, user } = await requireUser();
  // O autor é o único que vê a sua versão pendente: a RLS confirma a autoria.
  const { data: v } = await supabase.from("file_versions").select("id, account_id, created_by, status")
    .eq("id", versionId).maybeSingle();
  if (!v || v.created_by !== user.id || v.status !== "pending") return { ok: false, message: messages.db.forbidden };

  const result = await finalizeUpload(supabaseFinalizeDeps(), versionId);
  revalidatePath(`/conta/${v.account_id}`, "layout");
  if (result.status === "available") return { ok: true, message: messages.files.uploaded };
  return { ok: false, message: result.status === "rejected" ? result.reason : messages.db.generic };
}

export async function approveVersion(fd: FormData) {
  const id = idOf(fd, "accountId"), vid = idOf(fd, "versionId");
  if (!id || !vid) return;
  const { supabase } = await loadAccount(id);
  await supabase.rpc("approve_file_version", { p_version: vid });
  revalidatePath(`/conta/${id}`, "layout");
}

export async function setFileArchived(fd: FormData) {
  const id = idOf(fd, "accountId"), fid = idOf(fd, "fileId");
  if (!id || !fid) return;
  const { supabase } = await loadAccount(id);
  await supabase.rpc("set_file_archived", { p_file: fid, p_archived: fd.get("archived") === "true" });
  revalidatePath(`/conta/${id}`, "layout");
}
