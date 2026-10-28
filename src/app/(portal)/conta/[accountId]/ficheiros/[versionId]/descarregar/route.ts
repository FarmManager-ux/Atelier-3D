import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { uuidSchema } from "@/lib/validation/profile";

const BUCKET = "project-files";

/**
 * Descarga protegida: valida a sessão e, com o cliente DO UTILIZADOR (RLS), confirma que a
 * versão existe, está disponível e pertence à conta. O URL assinado dura 60 s.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ accountId: string; versionId: string }> },
) {
  const { accountId, versionId } = await params;
  const notFound = () => new NextResponse("Não encontrado", { status: 404, headers: { "Cache-Control": "no-store" } });
  if (!uuidSchema.safeParse(accountId).success || !uuidSchema.safeParse(versionId).success) return notFound();
  if (!isSupabaseConfigured()) return notFound();

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return new NextResponse("Não autenticado", { status: 401, headers: { "Cache-Control": "no-store" } });

  const { data: version } = await supabase.from("file_versions")
    .select("storage_path, original_filename, status")
    .eq("id", versionId).eq("account_id", accountId).eq("status", "available").maybeSingle();
  if (!version) return notFound();

  const { data, error } = await supabase.storage.from(BUCKET)
    .createSignedUrl(version.storage_path, 60, { download: version.original_filename });
  if (error || !data) return notFound();

  return NextResponse.redirect(data.signedUrl, { status: 302, headers: { "Cache-Control": "no-store" } });
}
