import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { contacts, scheduledMessages } from "@/db/schema";
import { userHasChannelAccess } from "@/lib/channel-access";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Não autenticado" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    channelId?: string;
    contactId?: string;
    dealId?: string;
    message?: string;
    scheduledAt?: string;
  } | null;

  if (!body?.channelId || !body?.contactId || !body?.message?.trim() || !body?.scheduledAt) {
    return Response.json(
      { error: "channelId, contactId, message e scheduledAt são obrigatórios" },
      { status: 400 }
    );
  }

  const scheduledAt = new Date(body.scheduledAt);
  if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now()) {
    return Response.json(
      { error: "Escolha uma data e hora no futuro." },
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

  const [contact] = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(eq(contacts.id, body.contactId))
    .limit(1);
  if (!contact) {
    return Response.json({ error: "Contato não encontrado" }, { status: 404 });
  }

  const [created] = await db
    .insert(scheduledMessages)
    .values({
      dealId: body.dealId || null,
      contactId: body.contactId,
      channelId: body.channelId,
      content: body.message.trim(),
      scheduledAt,
      createdBy: session.user.id,
    })
    .returning();

  return Response.json({ scheduledMessage: created });
}
