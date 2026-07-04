import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { contacts, messages, whatsappChannels } from "@/db/schema";
import { userHasChannelAccess } from "@/lib/channel-access";
import { decryptCredential } from "@/lib/credentials-crypto";
import { findOpenDealIdForContact } from "@/lib/messaging";
import { sendZapiText } from "@/lib/zapi";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Não autenticado" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    channelId?: string;
    contactId?: string;
    message?: string;
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

  const [channel] = await db
    .select()
    .from(whatsappChannels)
    .where(eq(whatsappChannels.id, body.channelId))
    .limit(1);
  if (!channel) {
    return Response.json({ error: "Canal não encontrado" }, { status: 404 });
  }

  const [contact] = await db
    .select({ id: contacts.id, phone: contacts.phone })
    .from(contacts)
    .where(eq(contacts.id, body.contactId))
    .limit(1);
  if (!contact) {
    return Response.json({ error: "Contato não encontrado" }, { status: 404 });
  }

  const messageText = body.message.trim();

  let zApiMessageId: string;
  try {
    const { messageId } = await sendZapiText(
      {
        zapiInstanceId: channel.zapiInstanceId,
        zapiToken: decryptCredential(channel.zapiToken),
        zapiClientToken: decryptCredential(channel.zapiClientToken),
      },
      contact.phone,
      messageText
    );
    zApiMessageId = messageId;
  } catch (error) {
    console.error("[messages/send] falha ao enviar via Z-API", error);
    return Response.json(
      { error: "Falha ao enviar mensagem via WhatsApp" },
      { status: 502 }
    );
  }

  const dealId = await findOpenDealIdForContact(contact.id);

  const [created] = await db
    .insert(messages)
    .values({
      dealId,
      contactId: contact.id,
      channelId: channel.id,
      direction: "saida",
      type: "texto",
      content: messageText,
      status: "enviado",
      zApiMessageId,
    })
    .returning();

  return Response.json({ message: created });
}
