import { auth } from "@/auth";
import { db } from "@/db";
import { messages } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { userHasChannelAccess } from "@/lib/channel-access";
import { createdAtMatch } from "@/lib/message-lookup";
import { editWhatsappMessage } from "@/lib/send-message";

export const dynamic = "force-dynamic";

// Espelha /api/messages/favorite (mesmo padrão de checar acesso ao canal
// antes de mexer na mensagem) — a mutação de verdade (edita na Z-API e só
// depois no banco) mora em editWhatsappMessage.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Não autenticado" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    id?: string;
    createdAt?: string;
    content?: string;
  } | null;

  if (!body?.id || !body.createdAt || typeof body.content !== "string" || !body.content.trim()) {
    return Response.json(
      { error: "id, createdAt e content são obrigatórios" },
      { status: 400 }
    );
  }

  const createdAt = new Date(body.createdAt);

  const [message] = await db
    .select({ channelId: messages.channelId })
    .from(messages)
    .where(and(eq(messages.id, body.id), ...createdAtMatch(createdAt)))
    .limit(1);
  if (!message) {
    return Response.json({ error: "Mensagem não encontrada" }, { status: 404 });
  }
  if (message.channelId) {
    const allowed = await userHasChannelAccess(session.user.id, session.user.role, message.channelId);
    if (!allowed) {
      return Response.json({ error: "Você não tem acesso a este canal" }, { status: 403 });
    }
  }

  const result = await editWhatsappMessage(body.id, createdAt, body.content.trim());
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 400 });
  }
  return Response.json({ ok: true });
}
