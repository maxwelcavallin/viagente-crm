import { auth } from "@/auth";
import { userHasChannelAccess } from "@/lib/channel-access";
import { sendTemplateStyledMessage, sendTextMessage } from "@/lib/send-message";
import type { MediaKind } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Não autenticado" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    channelId?: string;
    channelType?: "whatsapp" | "instagram";
    contactId?: string;
    message?: string;
    // Tarefa de mensagem executada manualmente (ver MessageTaskExecutor):
    // conjunto de mensagens do template (id real de message_template_items,
    // texto já editado à mão se for o caso), enviadas em sequência — ver
    // sendTemplateStyledMessage.
    items?: {
      id: string;
      content: string;
      mediaType: string | null;
      mediaFileName: string | null;
    }[];
    replyToMessageId?: string;
    replyToCreatedAt?: string;
  } | null;

  if (!body?.channelId || !body?.contactId) {
    return Response.json(
      { error: "channelId e contactId são obrigatórios" },
      { status: 400 }
    );
  }

  const allowed = await userHasChannelAccess(
    session.user.id,
    session.user.role,
    body.channelId
  );
  if (!allowed) {
    return Response.json(
      { error: "Você não tem acesso a este canal" },
      { status: 403 }
    );
  }

  if (body.items && body.items.length > 0) {
    const result = await sendTemplateStyledMessage({
      channelId: body.channelId,
      channelType: body.channelType,
      contactId: body.contactId,
      items: body.items.map((it) => ({
        id: it.id,
        content: it.content,
        mediaType: (it.mediaType as MediaKind | null) ?? null,
        mediaFileName: it.mediaFileName,
      })),
    });
    if (!result.ok) return Response.json({ error: result.error }, { status: 502 });
    return Response.json({ ok: true });
  }

  const message = body.message?.trim() ?? "";
  if (!message) {
    return Response.json({ error: "message é obrigatório" }, { status: 400 });
  }

  const result = await sendTextMessage({
    channelId: body.channelId,
    channelType: body.channelType,
    contactId: body.contactId,
    message,
    replyToMessageId: body.replyToMessageId || null,
    replyToCreatedAt: body.replyToCreatedAt ? new Date(body.replyToCreatedAt) : null,
  });

  if (!result.ok) {
    const status = result.error === "Canal não encontrado" || result.error === "Contato não encontrado" ? 404 : 502;
    return Response.json({ error: result.error }, { status });
  }

  return Response.json({ message: result.message });
}
