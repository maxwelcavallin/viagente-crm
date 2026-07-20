import { auth } from "@/auth";
import { getMediaUploadUrl, mediaPrefix, type MediaKind } from "@/lib/storage";

export const dynamic = "force-dynamic";

const VALID_TYPES: MediaKind[] = ["imagem", "audio", "documento", "video"];

// Espelha /api/messages/upload-url, mas a chave é compartilhada por
// template (não por mensagem) — `templateId` é gerado no cliente (mesmo
// template ainda não salvo, ver template-form-dialog.tsx) pra poder subir o
// anexo antes de criar a linha no banco.
export async function POST(request: Request) {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return Response.json({ error: "Acesso negado" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    templateId?: string;
    type?: string;
    contentType?: string;
  } | null;

  if (
    !body?.templateId ||
    !body?.type ||
    !VALID_TYPES.includes(body.type as MediaKind) ||
    !body?.contentType
  ) {
    return Response.json(
      { error: "templateId, type e contentType são obrigatórios" },
      { status: 400 }
    );
  }

  const type = body.type as MediaKind;
  const key = `${mediaPrefix(type)}/templates/${body.templateId}`;

  const uploadUrl = await getMediaUploadUrl(key, body.contentType);

  return Response.json({ uploadUrl });
}
