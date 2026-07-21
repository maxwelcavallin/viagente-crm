import { randomUUID } from "crypto";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { messages, whatsappChannels } from "@/db/schema";
import { mediaPrefix, uploadMediaToR2, type MediaKind } from "@/lib/storage";
import { findOpenDealIdForContact, findOrCreateContactByPhone } from "@/lib/messaging";
import { notifyNewMessage } from "@/lib/notifications";
import { maybeCreateAutoDeal } from "@/lib/auto-deal";
import { decryptCredential } from "@/lib/credentials-crypto";
import { getZapiChatByLid, type ZapiChannelCredentials } from "@/lib/zapi";

export const dynamic = "force-dynamic";

// Payloads confirmados na documentação oficial da Z-API
// (developer.z-api.io/webhooks/on-message-received-examples e
// on-whatsapp-message-status-changes). O campo "instanceId" no corpo é o
// único jeito documentado de cross-checar a origem do webhook contra o
// canal identificado na URL — a Z-API não expõe assinatura/HMAC.
type ZapiMediaPart = { mimeType?: string };
type ZapiIncomingMessage = {
  messageId: string;
  phone: string;
  // Identificador de privacidade do WhatsApp pro chat (ver
  // developer.z-api.io/en/tips/lid) — mais estável que "phone", que pode vir
  // mascarado como "<numero>@lid" em vez do número real (comum em mensagens
  // mandadas direto do aparelho, fora do CRM). Usado em
  // findOrCreateContactByPhone pra não criar um contato órfão a cada evento
  // mascarado.
  chatLid?: string;
  instanceId: string;
  fromMe?: boolean;
  // isGroup=true: "phone" é o id do grupo ("<id>-group"), "chatName" é o
  // nome do grupo, "senderName"/"senderPhoto"/"participantPhone" identificam
  // o participante que enviou. Em conversa individual, "photo" é a foto do
  // próprio contato e não há participantPhone.
  isGroup?: boolean;
  chatName?: string;
  photo?: string;
  senderName?: string;
  senderPhoto?: string;
  participantPhone?: string;
  momment?: number;
  text?: { message: string };
  image?: ZapiMediaPart & { imageUrl: string; caption?: string };
  video?: ZapiMediaPart & { videoUrl: string; caption?: string };
  audio?: ZapiMediaPart & { audioUrl: string };
  document?: ZapiMediaPart & { documentUrl: string; fileName?: string };
};
type ZapiStatusCallback = {
  type: "MessageStatusCallback";
  instanceId: string;
  status: "SENT" | "RECEIVED" | "READ" | "READ_BY_ME" | "PLAYED";
  ids: string[];
};

const STATUS_MAP: Record<ZapiStatusCallback["status"], "enviado" | "entregue" | "lido"> = {
  SENT: "enviado",
  RECEIVED: "entregue",
  READ: "lido",
  READ_BY_ME: "lido",
  PLAYED: "lido",
};

// Repasse best-effort do payload cru pra outro sistema que usa a mesma
// instância Z-API (ver whatsappChannels.relayWebhookUrl) — a Z-API só
// aceita uma URL cadastrada por evento, então quem precisa de mais de um
// consumidor tem que replicar por conta própria. Nunca lança e nunca
// bloqueia/atrasa o processamento normal do webhook.
async function relayZapiPayload(url: string, payload: unknown): Promise<void> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!res.ok) {
        console.error(`[webhook whatsapp] repasse pra ${url} respondeu ${res.status}`);
      }
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    console.error(`[webhook whatsapp] falha ao repassar pra ${url}`, error);
  }
}

async function downloadZapiMedia(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Falha ao baixar mídia da Z-API (status ${res.status})`);
  }
  return Buffer.from(await res.arrayBuffer());
}

async function handleStatusCallback(payload: ZapiStatusCallback) {
  const status = STATUS_MAP[payload.status];
  if (!status || payload.ids.length === 0) return;

  await db
    .update(messages)
    .set({ status })
    .where(inArray(messages.externalMessageId, payload.ids));
}

async function handleIncomingMessage(
  channelId: string,
  payload: ZapiIncomingMessage,
  creds: ZapiChannelCredentials
) {
  // fromMe=true e já existe uma linha com esse externalMessageId: foi o próprio
  // /api/messages/send que gravou na hora do envio, este webhook só está
  // confirmando o que já sabemos — ignora pra não duplicar. fromMe=true SEM
  // registro prévio é mensagem mandada direto do aparelho conectado (fora do
  // CRM) — precisa ser gravada aqui, senão some da conversa em /atendimento.
  if (payload.fromMe) {
    const [existing] = await db
      .select({ id: messages.id })
      .from(messages)
      .where(eq(messages.externalMessageId, payload.messageId))
      .limit(1);
    if (existing) return;
  }

  // "phone" pode vir mascarado como "<numero>@lid" (privacidade do WhatsApp,
  // comum em mensagens fromMe — ver comentário no tipo ZapiIncomingMessage).
  // Antes de identificar o contato, tenta resolver o telefone real via
  // /chats/{lid} — não documentado oficialmente, mas confirmado ao vivo que
  // devolve telefone+lid juntos pra chats que o WhatsApp já resolveu na
  // sessão conectada (ver getZapiChatByLid). Só cai pro lid como identidade
  // (via whatsappLid) quando o WhatsApp realmente nunca revelou o número —
  // limitação de privacidade do próprio WhatsApp, não recuperável.
  const isMaskedPhone = !payload.isGroup && payload.phone.endsWith("@lid");
  let resolvedPhone = payload.phone;
  if (isMaskedPhone) {
    const resolved = await getZapiChatByLid(creds, payload.phone);
    // /chats/{lid} não documentado formalmente — já visto devolvendo o
    // telefone ora com "+" ora sem (diferente do "phone" normal do webhook,
    // sempre só dígitos). Normaliza aqui pra não criar um contato duplicado
    // toda vez que esse formato variar entre uma mensagem e outra.
    if (resolved?.phone) resolvedPhone = resolved.phone.replace(/\D/g, "");
  }
  const whatsappLid = payload.chatLid ?? (isMaskedPhone ? payload.phone : null);

  // Em mensagem individual mandada por nós (fromMe), "senderName" é o nome
  // do NOSSO próprio perfil conectado, não o do contato — usá-lo aqui
  // sobrescreveria o nome do contato com o nosso (ver comentário no tipo
  // ZapiIncomingMessage sobre o mesmo problema de identidade com "phone").
  const contact = await findOrCreateContactByPhone(
    resolvedPhone,
    payload.isGroup ? payload.chatName : payload.fromMe ? undefined : payload.senderName,
    { isGroup: payload.isGroup, avatarUrl: payload.photo, whatsappLid }
  );
  const contactName =
    (payload.isGroup ? payload.chatName : payload.senderName)?.trim() || resolvedPhone;

  let dealId = await findOpenDealIdForContact(contact.id);
  // Só cria negócio automaticamente pra conversa individual nova (nunca
  // grupo) e nunca a partir de uma mensagem que o próprio atendente mandou.
  if (!dealId && !payload.fromMe && !payload.isGroup) {
    dealId = await maybeCreateAutoDeal(contact.id, contactName);
  }
  const messageId = randomUUID();
  const createdAt = payload.momment ? new Date(payload.momment) : new Date();

  let type: "texto" | "imagem" | "audio" | "documento" | "video" = "texto";
  let content: string | null = null;
  let mediaUrl: string | null = null;
  let mediaSource: { url: string; mimeType?: string } | null = null;

  if (payload.text) {
    type = "texto";
    content = payload.text.message;
  } else if (payload.image) {
    type = "imagem";
    content = payload.image.caption || null;
    mediaSource = { url: payload.image.imageUrl, mimeType: payload.image.mimeType };
  } else if (payload.video) {
    type = "video";
    content = payload.video.caption || null;
    mediaSource = { url: payload.video.videoUrl, mimeType: payload.video.mimeType };
  } else if (payload.audio) {
    type = "audio";
    mediaSource = { url: payload.audio.audioUrl, mimeType: payload.audio.mimeType };
  } else if (payload.document) {
    type = "documento";
    content = payload.document.fileName || null;
    mediaSource = { url: payload.document.documentUrl, mimeType: payload.document.mimeType };
  }

  if (mediaSource) {
    const kind = type as MediaKind;
    const key = `${mediaPrefix(kind)}/${channelId}/${messageId}`;
    const body = await downloadZapiMedia(mediaSource.url);
    const contentType = mediaSource.mimeType ?? "application/octet-stream";
    await uploadMediaToR2({ key, body, contentType });
    mediaUrl = `/api/media/${messageId}`;
  }

  await db.insert(messages).values({
    id: messageId,
    dealId,
    contactId: contact.id,
    channelId,
    direction: payload.fromMe ? "saida" : "entrada",
    type,
    content,
    mediaUrl,
    externalMessageId: payload.messageId,
    senderName: payload.isGroup ? payload.senderName : null,
    senderPhone: payload.isGroup ? payload.participantPhone : null,
    senderAvatarUrl: payload.isGroup ? payload.senderPhoto : null,
    createdAt,
  });

  // Notificação de "mensagem nova" é só pro que o contato mandou pra gente —
  // uma mensagem que o próprio atendente mandou do celular não precisa
  // notificar ninguém (ele já sabe que mandou).
  if (payload.fromMe) return;

  await notifyNewMessage({
    messageId,
    dealId,
    contactId: contact.id,
    contactName,
    channelId,
    type,
    content,
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const { channelId } = await params;

  const [channel] = await db
    .select({
      id: whatsappChannels.id,
      zapiInstanceId: whatsappChannels.zapiInstanceId,
      zapiToken: whatsappChannels.zapiToken,
      zapiClientToken: whatsappChannels.zapiClientToken,
      relayWebhookUrl: whatsappChannels.relayWebhookUrl,
    })
    .from(whatsappChannels)
    .where(eq(whatsappChannels.id, channelId))
    .limit(1);

  if (!channel) {
    return Response.json({ error: "Canal não encontrado" }, { status: 404 });
  }

  const payload = (await request.json().catch(() => null)) as
    | ZapiIncomingMessage
    | ZapiStatusCallback
    | null;

  if (!payload || payload.instanceId !== channel.zapiInstanceId) {
    return Response.json({ error: "instanceId não confere com o canal" }, { status: 401 });
  }

  if (channel.relayWebhookUrl) {
    void relayZapiPayload(channel.relayWebhookUrl, payload);
  }

  try {
    if ("type" in payload && payload.type === "MessageStatusCallback") {
      await handleStatusCallback(payload);
    } else if ("messageId" in payload) {
      // fromMe=true também passa por aqui — handleIncomingMessage faz o
      // dedupe contra o que o nosso próprio /api/messages/send já gravou e
      // só insere de fato mensagens mandadas de outro aparelho conectado.
      await handleIncomingMessage(channelId, payload, {
        zapiInstanceId: channel.zapiInstanceId,
        zapiToken: decryptCredential(channel.zapiToken),
        zapiClientToken: decryptCredential(channel.zapiClientToken),
      });
    }
  } catch (error) {
    console.error("[webhook whatsapp] erro ao processar payload", error);
    return Response.json({ error: "Erro ao processar webhook" }, { status: 500 });
  }

  return Response.json({ ok: true });
}
