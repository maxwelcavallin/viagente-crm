import { auth } from "@/auth";
import { userHasChannelAccess } from "@/lib/channel-access";
import { sendTextMessage } from "@/lib/send-message";

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
    replyToMessageId?: string;
    replyToCreatedAt?: string;
  } | null;

  if (!body?.channelId || !body?.contactId || !body?.message?.trim()) {
    return Response.json(
      { error: "channelId, contactId e message são obrigatórios" },
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

  const result = await sendTextMessage({
    channelId: body.channelId,
    channelType: body.channelType,
    contactId: body.contactId,
    message: body.message.trim(),
    replyToMessageId: body.replyToMessageId || null,
    replyToCreatedAt: body.replyToCreatedAt ? new Date(body.replyToCreatedAt) : null,
  });

  if (!result.ok) {
    const status = result.error === "Canal não encontrado" || result.error === "Contato não encontrado" ? 404 : 502;
    return Response.json({ error: result.error }, { status });
  }

  return Response.json({ message: result.message });
}
