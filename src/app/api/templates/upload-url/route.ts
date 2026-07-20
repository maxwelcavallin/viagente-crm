import { auth } from "@/auth";
import { getMediaUploadUrl, mediaPrefix, type MediaKind } from "@/lib/storage";

export const dynamic = "force-dynamic";

const VALID_TYPES: MediaKind[] = ["imagem", "audio", "documento", "video"];

// Espelha /api/messages/upload-url, mas a chave é por MENSAGEM do template
// (message_template_items.id, não o template inteiro — um template agora é
// um conjunto de várias mensagens, cada uma com seu próprio anexo opcional).
// `itemId` é gerado no cliente (mensagem ainda não salva, ver
// template-form-dialog.tsx) pra poder subir o anexo antes de criar a linha.
export async function POST(request: Request) {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return Response.json({ error: "Acesso negado" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    itemId?: string;
    type?: string;
    contentType?: string;
  } | null;

  if (
    !body?.itemId ||
    !body?.type ||
    !VALID_TYPES.includes(body.type as MediaKind) ||
    !body?.contentType
  ) {
    return Response.json(
      { error: "itemId, type e contentType são obrigatórios" },
      { status: 400 }
    );
  }

  const type = body.type as MediaKind;
  const key = `${mediaPrefix(type)}/templates/${body.itemId}`;

  const uploadUrl = await getMediaUploadUrl(key, body.contentType);

  return Response.json({ uploadUrl });
}
