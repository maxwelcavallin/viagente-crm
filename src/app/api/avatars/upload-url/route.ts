import { auth } from "@/auth";
import { getMediaUploadUrl } from "@/lib/storage";

export const dynamic = "force-dynamic";

const VALID_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

// Espelha /api/templates/upload-url, mas a chave é fixa por usuário
// ("avatars/{id}", sem sufixo de extensão — a Content-Type na hora de servir
// já carrega essa informação) — cada upload novo sobrescreve o anterior, não
// existe histórico de fotos antigas. Só o próprio usuário pode subir a
// própria foto (sem userId no body: sempre usa session.user.id).
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Não autenticado" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    contentType?: string;
  } | null;

  if (!body?.contentType || !VALID_CONTENT_TYPES.has(body.contentType)) {
    return Response.json(
      { error: "contentType inválido — envie uma imagem jpeg, png, webp ou gif." },
      { status: 400 }
    );
  }

  const key = `avatars/${session.user.id}`;
  const uploadUrl = await getMediaUploadUrl(key, body.contentType);

  return Response.json({ uploadUrl });
}
