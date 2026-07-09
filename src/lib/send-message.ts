import { eq } from "drizzle-orm";
import { db } from "@/db";
import { contacts, messages, whatsappChannels } from "@/db/schema";
import { decryptCredential } from "@/lib/credentials-crypto";
import { findOpenDealIdForContact } from "@/lib/messaging";
import { sendZapiText } from "@/lib/zapi";

export type SendTextMessageResult =
  | { ok: true; message: typeof messages.$inferSelect }
  | { ok: false; error: string };

// Núcleo do envio de texto via Z-API, compartilhado entre o composer
// (/api/messages/send) e o cron de mensagens agendadas
// (/api/cron/send-scheduled-messages) — mantém a lógica de "achar canal,
// achar contato, enviar, gravar em messages" num único lugar.
export async function sendTextMessage(params: {
  channelId: string;
  contactId: string;
  message: string;
  replyToMessageId?: string | null;
  replyToCreatedAt?: Date | null;
}): Promise<SendTextMessageResult> {
  const [channel] = await db
    .select()
    .from(whatsappChannels)
    .where(eq(whatsappChannels.id, params.channelId))
    .limit(1);
  if (!channel) return { ok: false, error: "Canal não encontrado" };

  const [contact] = await db
    .select({ id: contacts.id, phone: contacts.phone })
    .from(contacts)
    .where(eq(contacts.id, params.contactId))
    .limit(1);
  if (!contact) return { ok: false, error: "Contato não encontrado" };

  let zApiMessageId: string;
  try {
    const { messageId } = await sendZapiText(
      {
        zapiInstanceId: channel.zapiInstanceId,
        zapiToken: decryptCredential(channel.zapiToken),
        zapiClientToken: decryptCredential(channel.zapiClientToken),
      },
      contact.phone,
      params.message
    );
    zApiMessageId = messageId;
  } catch (error) {
    console.error("[send-message] falha ao enviar via Z-API", error);
    return { ok: false, error: "Falha ao enviar mensagem via WhatsApp" };
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
      content: params.message,
      status: "enviado",
      zApiMessageId,
      replyToMessageId: params.replyToMessageId ?? null,
      replyToCreatedAt: params.replyToCreatedAt ?? null,
    })
    .returning();

  return { ok: true, message: created };
}
