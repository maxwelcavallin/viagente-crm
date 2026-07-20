import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { messageTemplates } from "@/db/schema";
import { getMediaSignedUrl, mediaPrefix, type MediaKind } from "@/lib/storage";

export const dynamic = "force-dynamic";

// Espelha /api/media/[messageId] (redireciona pra uma URL assinada de curta
// duração no R2) — usado pra tocar/pré-visualizar o anexo de um template
// dentro do formulário de edição, e também na hora do envio real (ver
// sendMediaMessage em src/lib/send-message.ts, que lê a chave direto, sem
// passar por esta rota).
const EXTENSION_BY_TYPE: Record<string, string> = {
  imagem: "jpg",
  video: "mp4",
  audio: "ogg",
  documento: "pdf",
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ templateId: string }> }
) {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return Response.json({ error: "Acesso negado" }, { status: 403 });
  }

  const { templateId } = await params;
  const wantsDownload = new URL(request.url).searchParams.has("download");

  const [template] = await db
    .select({ mediaType: messageTemplates.mediaType, mediaFileName: messageTemplates.mediaFileName })
    .from(messageTemplates)
    .where(eq(messageTemplates.id, templateId))
    .limit(1);

  if (!template?.mediaType) {
    return Response.json({ error: "Anexo não encontrado" }, { status: 404 });
  }

  const type = template.mediaType as MediaKind;
  const key = `${mediaPrefix(type)}/templates/${templateId}`;

  try {
    const downloadFileName = wantsDownload
      ? (template.mediaFileName ?? `${type}-${templateId}.${EXTENSION_BY_TYPE[type] ?? "bin"}`)
      : undefined;
    const signedUrl = await getMediaSignedUrl(key, { downloadFileName });
    return Response.redirect(signedUrl, 302);
  } catch (error) {
    console.error("[template media proxy] falha ao gerar URL assinada", error);
    return Response.json({ error: "Anexo indisponível" }, { status: 404 });
  }
}
