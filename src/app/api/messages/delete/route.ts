import { auth } from "@/auth";
import { db } from "@/db";
import { messages } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { userHasChannelAccess } from "@/lib/channel-access";
import { deleteWhatsappMessage } from "@/lib/send-message";

export const dynamic = "force-dynamic";

// Espelha /api/messages/favorite — a mutação de verdade (apaga na Z-API e só
// depois marca no banco) mora em deleteWhatsappMessage.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Não autenticado" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    id?: string;
    createdAt?: string;
    scope?: "me" | "everyone";
  } | null;

  if (!body?.id || !body.createdAt || (body.scope !== "me" && body.scope !== "everyone")) {
    return Response.json(
      { error: 'id, createdAt e scope ("me" ou "everyone") são obrigatórios' },
      { status: 400 }
    );
  }

  const createdAt = new Date(body.createdAt);

  const [message] = await db
    .select({ channelId: messages.channelId })
    .from(messages)
    .where(and(eq(messages.id, body.id), eq(messages.createdAt, createdAt)))
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

  const result = await deleteWhatsappMessage(body.id, createdAt, body.scope);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 400 });
  }
  return Response.json({ ok: true });
}
