import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { messages } from "@/db/schema";
import { userHasChannelAccess } from "@/lib/channel-access";

export const dynamic = "force-dynamic";

// `createdAt` é opcional mas recomendado: messages é particionada por mês
// (created_at), então informá-lo permite ao Postgres podar pra partição
// certa em vez de varrer todas.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Não autenticado" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    id?: string;
    createdAt?: string;
    isFavorite?: boolean;
  } | null;

  if (!body?.id || typeof body.isFavorite !== "boolean") {
    return Response.json(
      { error: "id e isFavorite são obrigatórios" },
      { status: 400 }
    );
  }

  const where = body.createdAt
    ? and(eq(messages.id, body.id), eq(messages.createdAt, new Date(body.createdAt)))
    : eq(messages.id, body.id);

  const [message] = await db
    .select({ id: messages.id, channelId: messages.channelId })
    .from(messages)
    .where(where)
    .limit(1);
  if (!message) {
    return Response.json({ error: "Mensagem não encontrada" }, { status: 404 });
  }

  if (message.channelId) {
    const allowed = await userHasChannelAccess(
      session.user.id,
      session.user.role,
      message.channelId
    );
    if (!allowed) {
      return Response.json(
        { error: "Você não tem acesso a este canal" },
        { status: 403 }
      );
    }
  }

  await db
    .update(messages)
    .set({ isFavorite: body.isFavorite })
    .where(where);

  return Response.json({ ok: true });
}
