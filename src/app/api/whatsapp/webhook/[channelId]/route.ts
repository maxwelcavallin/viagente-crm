import { randomUUID } from "crypto";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { messages, whatsappChannels } from "@/db/schema";
import { mediaPrefix, uploadMediaToR2, type MediaKind } from "@/lib/storage";
import { findOpenDealIdForContact, findOrCreateContactByPhone } from "@/lib/messaging";

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
  instanceId: string;
  fromMe?: boolean;
  senderName?: string;
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
    .where(inArray(messages.zApiMessageId, payload.ids));
}

async function handleIncomingMessage(
  channelId: string,
  payload: ZapiIncomingMessage
) {
  const contact = await findOrCreateContactByPhone(
    payload.phone,
    payload.senderName
  );
  const dealId = await findOpenDealIdForContact(contact.id);
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
    direction: "entrada",
    type,
    content,
    mediaUrl,
    zApiMessageId: payload.messageId,
    createdAt,
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const { channelId } = await params;

  const [channel] = await db
    .select({ id: whatsappChannels.id, zapiInstanceId: whatsappChannels.zapiInstanceId })
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

  try {
    if ("type" in payload && payload.type === "MessageStatusCallback") {
      await handleStatusCallback(payload);
    } else if ("messageId" in payload && !payload.fromMe) {
      await handleIncomingMessage(channelId, payload);
    }
    // fromMe=true é ignorado: mensagens enviadas pelo nosso próprio
    // /api/messages/send já são gravadas na hora do envio.
  } catch (error) {
    console.error("[webhook whatsapp] erro ao processar payload", error);
    return Response.json({ error: "Erro ao processar webhook" }, { status: 500 });
  }

  return Response.json({ ok: true });
}
