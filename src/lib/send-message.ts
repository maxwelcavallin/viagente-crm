import { eq } from "drizzle-orm";
import { db } from "@/db";
import { contacts, instagramChannels, messages, whatsappChannels } from "@/db/schema";
import { decryptCredential } from "@/lib/credentials-crypto";
import { findOpenDealIdForContact } from "@/lib/messaging";
import { sendZapiText } from "@/lib/zapi";
import { sendInstagramText } from "@/lib/instagram-graph";

export type SendTextMessageResult =
  | { ok: true; message: typeof messages.$inferSelect }
  | { ok: false; error: string };

type SendTextMessageParams = {
  channelId: string;
  // Default "whatsapp" — todos os callers existentes (task-automation, nps,
  // cron de agendadas, api-v1) continuam WhatsApp-only por decisão de escopo
  // da Etapa 25; só o composer do Atendimento passa "instagram".
  channelType?: "whatsapp" | "instagram";
  contactId: string;
  message: string;
  replyToMessageId?: string | null;
  replyToCreatedAt?: Date | null;
};

async function sendViaWhatsapp(
  channelId: string,
  contactId: string,
  message: string
): Promise<{ ok: true; externalMessageId: string } | { ok: false; error: string }> {
  const [channel] = await db
    .select()
    .from(whatsappChannels)
    .where(eq(whatsappChannels.id, channelId))
    .limit(1);
  if (!channel) return { ok: false, error: "Canal não encontrado" };

  const [contact] = await db
    .select({ id: contacts.id, phone: contacts.phone })
    .from(contacts)
    .where(eq(contacts.id, contactId))
    .limit(1);
  if (!contact) return { ok: false, error: "Contato não encontrado" };
  if (!contact.phone) return { ok: false, error: "Contato não tem telefone (WhatsApp)" };

  try {
    const { messageId } = await sendZapiText(
      {
        zapiInstanceId: channel.zapiInstanceId,
        zapiToken: decryptCredential(channel.zapiToken),
        zapiClientToken: decryptCredential(channel.zapiClientToken),
      },
      contact.phone,
      message
    );
    return { ok: true, externalMessageId: messageId };
  } catch (error) {
    console.error("[send-message] falha ao enviar via Z-API", error);
    return { ok: false, error: "Falha ao enviar mensagem via WhatsApp" };
  }
}

async function sendViaInstagram(
  channelId: string,
  contactId: string,
  message: string
): Promise<{ ok: true; externalMessageId: string } | { ok: false; error: string }> {
  const [channel] = await db
    .select()
    .from(instagramChannels)
    .where(eq(instagramChannels.id, channelId))
    .limit(1);
  if (!channel) return { ok: false, error: "Canal não encontrado" };

  const [contact] = await db
    .select({ id: contacts.id, instagramUserId: contacts.instagramUserId })
    .from(contacts)
    .where(eq(contacts.id, contactId))
    .limit(1);
  if (!contact) return { ok: false, error: "Contato não encontrado" };
  if (!contact.instagramUserId) {
    return { ok: false, error: "Contato não tem conta do Instagram vinculada" };
  }

  try {
    const { messageId } = await sendInstagramText(
      decryptCredential(channel.accessToken),
      contact.instagramUserId,
      message
    );
    return { ok: true, externalMessageId: messageId };
  } catch (error) {
    console.error("[send-message] falha ao enviar via Instagram", error);
    return { ok: false, error: "Falha ao enviar mensagem via Instagram" };
  }
}

// Núcleo do envio de texto, compartilhado entre o composer
// (/api/messages/send) e o cron de mensagens agendadas
// (/api/cron/send-scheduled-messages) — mantém a lógica de "achar canal,
// achar contato, enviar, gravar em messages" num único lugar, despachando
// pro provedor certo conforme channelType.
export async function sendTextMessage(
  params: SendTextMessageParams
): Promise<SendTextMessageResult> {
  const channelType = params.channelType ?? "whatsapp";
  const result =
    channelType === "instagram"
      ? await sendViaInstagram(params.channelId, params.contactId, params.message)
      : await sendViaWhatsapp(params.channelId, params.contactId, params.message);

  if (!result.ok) return result;

  const dealId = await findOpenDealIdForContact(params.contactId);

  const [created] = await db
    .insert(messages)
    .values({
      dealId,
      contactId: params.contactId,
      channelId: params.channelId,
      channelType,
      direction: "saida",
      type: "texto",
      content: params.message,
      status: "enviado",
      externalMessageId: result.externalMessageId,
      replyToMessageId: params.replyToMessageId ?? null,
      replyToCreatedAt: params.replyToCreatedAt ?? null,
    })
    .returning();

  return { ok: true, message: created };
}
