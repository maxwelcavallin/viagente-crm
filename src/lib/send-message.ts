import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { contacts, instagramChannels, messages, whatsappChannels } from "@/db/schema";
import { decryptCredential } from "@/lib/credentials-crypto";
import { findOpenDealIdForContact } from "@/lib/messaging";
import { copyMediaInR2, getMediaSignedUrl, mediaPrefix, type MediaKind } from "@/lib/storage";
import {
  sendInstagramAttachment,
  sendInstagramText,
} from "@/lib/instagram-graph";
import {
  sendZapiAudio,
  sendZapiDocument,
  sendZapiImage,
  sendZapiText,
  sendZapiVideo,
} from "@/lib/zapi";

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

function extensionFromFileName(fileName: string): string {
  const ext = fileName.split(".").pop();
  return ext && ext !== fileName ? ext.toLowerCase() : "bin";
}

// Instagram Messaging não tem tipo "document" (ver sendInstagramAttachment).
const INSTAGRAM_ATTACHMENT_TYPE: Partial<Record<MediaKind, "image" | "video" | "audio">> = {
  imagem: "image",
  video: "video",
  audio: "audio",
};

export type SendMediaMessageParams = {
  channelId: string;
  channelType?: "whatsapp" | "instagram";
  contactId: string;
  // Chave no R2 de onde copiar os bytes (ex: anexo de um template) — a chave
  // final da mensagem é sempre gerada aqui a partir de um messageId novo.
  sourceKey: string;
  mediaKind: MediaKind;
  caption?: string;
  fileName?: string;
};

export type SendMediaMessageResult =
  | { ok: true; message: typeof messages.$inferSelect }
  | { ok: false; error: string };

// Espelha /api/messages/send-media (upload manual do composer), mas parte de
// um objeto já existente no R2 (o anexo do template) em vez de um upload novo
// do navegador — por isso primeiro copia pra chave por mensagem (ver
// copyMediaInR2 em storage.ts) antes de gerar a URL assinada que a
// Z-API/Instagram vão buscar. Áudio sempre sai como nota de voz (waveform),
// igual uma gravação ao vivo no composer — ver sendZapiAudio.
export async function sendMediaMessage(
  params: SendMediaMessageParams
): Promise<SendMediaMessageResult> {
  const channelType = params.channelType ?? "whatsapp";
  const messageId = randomUUID();
  const destKey = `${mediaPrefix(params.mediaKind)}/${params.channelId}/${messageId}`;

  try {
    await copyMediaInR2(params.sourceKey, destKey);
  } catch (error) {
    console.error("[send-message] falha ao copiar anexo do template no R2", error);
    return { ok: false, error: "Falha ao preparar o anexo pra envio" };
  }

  let externalMessageId: string;
  try {
    const signedUrl = await getMediaSignedUrl(destKey, { expiresInSeconds: 300 });

    if (channelType === "instagram") {
      const instagramType = INSTAGRAM_ATTACHMENT_TYPE[params.mediaKind];
      if (!instagramType) {
        return { ok: false, error: "Instagram não suporta esse tipo de anexo" };
      }
      const [channel] = await db
        .select()
        .from(instagramChannels)
        .where(eq(instagramChannels.id, params.channelId))
        .limit(1);
      if (!channel) return { ok: false, error: "Canal não encontrado" };

      const [contact] = await db
        .select({ instagramUserId: contacts.instagramUserId })
        .from(contacts)
        .where(eq(contacts.id, params.contactId))
        .limit(1);
      if (!contact) return { ok: false, error: "Contato não encontrado" };
      if (!contact.instagramUserId) {
        return { ok: false, error: "Contato não tem conta do Instagram vinculada" };
      }

      const { messageId: extId } = await sendInstagramAttachment(
        decryptCredential(channel.accessToken),
        contact.instagramUserId,
        instagramType,
        signedUrl
      );
      externalMessageId = extId;
    } else {
      const [channel] = await db
        .select()
        .from(whatsappChannels)
        .where(eq(whatsappChannels.id, params.channelId))
        .limit(1);
      if (!channel) return { ok: false, error: "Canal não encontrado" };

      const [contact] = await db
        .select({ phone: contacts.phone })
        .from(contacts)
        .where(eq(contacts.id, params.contactId))
        .limit(1);
      if (!contact) return { ok: false, error: "Contato não encontrado" };
      if (!contact.phone) return { ok: false, error: "Contato não tem telefone (WhatsApp)" };

      const creds = {
        zapiInstanceId: channel.zapiInstanceId,
        zapiToken: decryptCredential(channel.zapiToken),
        zapiClientToken: decryptCredential(channel.zapiClientToken),
      };
      const { messageId: extId } =
        params.mediaKind === "imagem"
          ? await sendZapiImage(creds, contact.phone, signedUrl, params.caption)
          : params.mediaKind === "video"
            ? await sendZapiVideo(creds, contact.phone, signedUrl, params.caption)
            : params.mediaKind === "audio"
              ? await sendZapiAudio(creds, contact.phone, signedUrl)
              : await sendZapiDocument(
                  creds,
                  contact.phone,
                  signedUrl,
                  extensionFromFileName(params.fileName ?? "arquivo.bin"),
                  params.fileName
                );
      externalMessageId = extId;
    }
  } catch (error) {
    console.error(`[send-message] falha ao enviar mídia via ${channelType}`, error);
    return {
      ok: false,
      error: `Falha ao enviar mídia via ${channelType === "instagram" ? "Instagram" : "WhatsApp"}`,
    };
  }

  const dealId = await findOpenDealIdForContact(params.contactId);

  const [created] = await db
    .insert(messages)
    .values({
      id: messageId,
      dealId,
      contactId: params.contactId,
      channelId: params.channelId,
      channelType,
      direction: "saida",
      type: params.mediaKind,
      content: params.caption?.trim() || params.fileName || null,
      mediaUrl: `/api/media/${messageId}`,
      status: "enviado",
      externalMessageId,
    })
    .returning();

  return { ok: true, message: created };
}

// Uma mensagem separada dentro do conjunto do template — id é o id da linha
// em message_template_items, usado como chave do anexo no R2
// (`templates/${id}`, ver mediaPrefix) quando mediaType existe. content já
// vem com as variáveis substituídas (e, no envio manual de tarefa,
// possivelmente editado à mão pelo atendente antes de mandar).
export type TemplateMessageItem = {
  id: string;
  content: string;
  mediaType: MediaKind | null;
  mediaFileName: string | null;
};

export type SendTemplateStyledMessageParams = {
  channelId: string;
  channelType?: "whatsapp" | "instagram";
  contactId: string;
  // Um template é um conjunto ORDENADO de mensagens separadas — enviadas uma
  // por uma, na ordem do array, cada uma como sua própria mensagem no
  // WhatsApp/Instagram (não uma mensagem só concatenada).
  items: TemplateMessageItem[];
};

// Regra de composição texto+anexo de cada mensagem do template: áudio nunca
// aceita legenda (WhatsApp não tem esse conceito pra nota de voz — ver
// sendZapiAudio), então o texto sai como mensagem separada ANTES do áudio,
// na ordem natural de uma conversa. Imagem/vídeo/documento já embutem o
// texto como legenda na mesma mensagem. Item sem anexo cai no envio de
// texto simples de sempre. Envio é sequencial (aguarda cada item antes do
// próximo) pra preservar a ordem escolhida no editor do template.
export async function sendTemplateStyledMessage(
  params: SendTemplateStyledMessageParams
): Promise<{ ok: boolean; error?: string }> {
  for (const item of params.items) {
    const text = item.content.trim();

    if (!item.mediaType) {
      if (!text) continue;
      const result = await sendTextMessage({
        channelId: params.channelId,
        channelType: params.channelType,
        contactId: params.contactId,
        message: text,
      });
      if (!result.ok) return { ok: false, error: result.error };
      continue;
    }

    if (text && item.mediaType === "audio") {
      const textResult = await sendTextMessage({
        channelId: params.channelId,
        channelType: params.channelType,
        contactId: params.contactId,
        message: text,
      });
      if (!textResult.ok) return { ok: false, error: textResult.error };
    }

    const mediaResult = await sendMediaMessage({
      channelId: params.channelId,
      channelType: params.channelType,
      contactId: params.contactId,
      sourceKey: `${mediaPrefix(item.mediaType)}/templates/${item.id}`,
      mediaKind: item.mediaType,
      caption: item.mediaType === "audio" ? undefined : text || undefined,
      fileName: item.mediaFileName ?? undefined,
    });
    if (!mediaResult.ok) return { ok: false, error: mediaResult.error };
  }

  return { ok: true };
}
