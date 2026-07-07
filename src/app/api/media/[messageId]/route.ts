import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { messages } from "@/db/schema";
import { userHasChannelAccess } from "@/lib/channel-access";
import { getMediaSignedUrl, mediaPrefix, type MediaKind } from "@/lib/storage";

export const dynamic = "force-dynamic";

// Redireciona pra uma URL assinada de curta duração no R2. Nunca expomos uma
// URL pública permanente pra poder aplicar o mesmo controle de acesso por
// canal que vale pro resto da conversa (ver seção 7 da spec).
const EXTENSION_BY_TYPE: Record<string, string> = {
  imagem: "jpg",
  video: "mp4",
  audio: "ogg",
  documento: "pdf",
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ messageId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { messageId } = await params;
  const wantsDownload = new URL(request.url).searchParams.has("download");

  const [message] = await db
    .select({
      channelId: messages.channelId,
      type: messages.type,
      content: messages.content,
      mediaUrl: messages.mediaUrl,
    })
    .from(messages)
    .where(eq(messages.id, messageId))
    .limit(1);

  if (!message || !message.mediaUrl) {
    return Response.json({ error: "Mídia não encontrada" }, { status: 404 });
  }

  if (message.channelId) {
    const allowed = await userHasChannelAccess(
      session.user.id,
      session.user.role,
      message.channelId
    );
    if (!allowed) {
      return Response.json({ error: "Acesso negado a este canal" }, { status: 403 });
    }
  }

  const key = `${mediaPrefix(message.type as MediaKind)}/${message.channelId}/${messageId}`;

  try {
    const downloadFileName = wantsDownload
      ? message.type === "documento" && message.content
        ? message.content
        : `${message.type}-${messageId}.${EXTENSION_BY_TYPE[message.type] ?? "bin"}`
      : undefined;
    const signedUrl = await getMediaSignedUrl(key, { downloadFileName });
    return Response.redirect(signedUrl, 302);
  } catch (error) {
    console.error("[media proxy] falha ao gerar URL assinada", error);
    return Response.json({ error: "Mídia expirada ou indisponível" }, { status: 404 });
  }
}
