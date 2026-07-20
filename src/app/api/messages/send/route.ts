import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { messageTemplates } from "@/db/schema";
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
    // quando o template linkado à tarefa tem anexo, ele vai junto do envio —
    // ver sendTemplateStyledMessage.
    templateId?: string | null;
    replyToMessageId?: string;
    replyToCreatedAt?: string;
  } | null;

  const message = body?.message?.trim() ?? "";
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

  if (body.templateId) {
    const [template] = await db
      .select({ mediaType: messageTemplates.mediaType, mediaFileName: messageTemplates.mediaFileName })
      .from(messageTemplates)
      .where(eq(messageTemplates.id, body.templateId))
      .limit(1);

    if (template?.mediaType) {
      const result = await sendTemplateStyledMessage({
        channelId: body.channelId,
        channelType: body.channelType,
        contactId: body.contactId,
        message,
        media: {
          templateId: body.templateId,
          kind: template.mediaType as MediaKind,
          fileName: template.mediaFileName,
        },
      });
      if (!result.ok) return Response.json({ error: result.error }, { status: 502 });
      return Response.json({ ok: true });
    }
  }

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
