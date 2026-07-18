import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { instagramChannels, messages } from "@/db/schema";
import { findOpenDealIdForContact, findOrCreateContactByInstagramUserId } from "@/lib/messaging";
import { getInstagramUserProfile } from "@/lib/instagram-graph";
import { decryptCredential } from "@/lib/credentials-crypto";
import { maybeCreateAutoDeal } from "@/lib/auto-deal";
import { notifyNewMessage } from "@/lib/notifications";
import { mediaPrefix, uploadMediaToR2, type MediaKind } from "@/lib/storage";

export const dynamic = "force-dynamic";

// Payload confirmado na documentação oficial (Messenger Platform / Instrução
// "Messaging" webhooks): developers.facebook.com/docs/messenger-platform.
// is_echo=true: mensagem mandada pela própria conta conectada (de outro
// cliente, ex: app do Instagram) — equivalente ao fromMe da Z-API.
type InstagramAttachment = {
  type: "image" | "video" | "audio" | "file";
  payload?: { url?: string };
};
type InstagramMessagingEvent = {
  sender: { id: string };
  recipient: { id: string };
  timestamp: number;
  message?: {
    mid: string;
    text?: string;
    is_echo?: boolean;
    attachments?: InstagramAttachment[];
  };
};
type InstagramWebhookPayload = {
  object: string;
  entry: { id: string; time: number; messaging?: InstagramMessagingEvent[] }[];
};

async function downloadAttachment(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Falha ao baixar mídia do Instagram (status ${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

const ATTACHMENT_TYPE_MAP: Record<string, MediaKind> = {
  image: "imagem",
  video: "video",
  audio: "audio",
};

async function handleMessagingEvent(event: InstagramMessagingEvent) {
  if (!event.message) return; // ignora read/delivery/postback — só mensagens

  const isEcho = Boolean(event.message.is_echo);
  // Quando é eco (mandado pela própria conta), sender é a conta conectada e
  // recipient é o contato — o contrário do caso normal de entrada.
  const ourInstagramUserId = isEcho ? event.sender.id : event.recipient.id;
  const contactIgsid = isEcho ? event.recipient.id : event.sender.id;

  const [channel] = await db
    .select({ id: instagramChannels.id, accessToken: instagramChannels.accessToken })
    .from(instagramChannels)
    .where(eq(instagramChannels.instagramUserId, ourInstagramUserId))
    .limit(1);
  if (!channel) {
    // Diagnóstico: se o ID que o Meta manda no payload (recipient/sender,
    // dependendo de eco) não bater com o instagramUserId salvo no canal
    // (vindo do /me da troca OAuth), a mensagem cai aqui silenciosamente.
    console.error("[webhook instagram] nenhum canal conectado com instagramUserId =", ourInstagramUserId);
    return;
  }

  if (isEcho) {
    const [existing] = await db
      .select({ id: messages.id })
      .from(messages)
      .where(eq(messages.externalMessageId, event.message.mid))
      .limit(1);
    if (existing) return;
  }

  let profileName: string | null = null;
  let profilePic: string | null = null;
  let profileUsername: string | null = null;
  const accessToken = decryptCredential(channel.accessToken);
  if (!isEcho) {
    const profile = await getInstagramUserProfile(accessToken, contactIgsid);
    profileName = profile?.name ?? null;
    profilePic = profile?.profilePic ?? null;
    profileUsername = profile?.username ?? null;
  }

  const contact = await findOrCreateContactByInstagramUserId(
    contactIgsid,
    profileName ?? undefined,
    profilePic ?? undefined,
    profileUsername ?? undefined
  );

  let dealId = await findOpenDealIdForContact(contact.id);
  // Instagram Direct não tem conversa em grupo neste escopo — só o gate de
  // "não é eco" (equivalente ao !fromMe da Z-API) é necessário.
  if (!dealId && !isEcho) {
    dealId = await maybeCreateAutoDeal(contact.id, profileName ?? contactIgsid);
  }

  const messageId = randomUUID();
  const createdAt = new Date(event.timestamp);

  let type: "texto" | "imagem" | "audio" | "video" = "texto";
  const content: string | null = event.message.text ?? null;
  let mediaUrl: string | null = null;

  const attachment = event.message.attachments?.[0];
  if (attachment && ATTACHMENT_TYPE_MAP[attachment.type] && attachment.payload?.url) {
    type = ATTACHMENT_TYPE_MAP[attachment.type] as "imagem" | "audio" | "video";
    const key = `${mediaPrefix(type)}/${channel.id}/${messageId}`;
    const body = await downloadAttachment(attachment.payload.url);
    await uploadMediaToR2({ key, body, contentType: "application/octet-stream" });
    mediaUrl = `/api/media/${messageId}`;
  }

  await db.insert(messages).values({
    id: messageId,
    dealId,
    contactId: contact.id,
    channelId: channel.id,
    channelType: "instagram",
    direction: isEcho ? "saida" : "entrada",
    type,
    content,
    mediaUrl,
    status: "enviado",
    externalMessageId: event.message.mid,
    createdAt,
  });

  if (isEcho) return;

  await notifyNewMessage({
    messageId,
    dealId,
    contactId: contact.id,
    contactName: profileName ?? contactIgsid,
    channelId: channel.id,
    type,
    content,
  });
}

// Handshake de verificação exigido pelo Meta ao cadastrar a URL de webhook
// no painel do app (developers.facebook.com/docs/graph-api/webhooks).
export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && challenge && token === process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as InstagramWebhookPayload | null;
  if (!payload) return Response.json({ error: "Payload inválido" }, { status: 400 });

  try {
    for (const entry of payload.entry ?? []) {
      for (const event of entry.messaging ?? []) {
        await handleMessagingEvent(event);
      }
    }
  } catch (error) {
    console.error("[webhook instagram] erro ao processar payload", error);
    return Response.json({ error: "Erro ao processar webhook" }, { status: 500 });
  }

  return Response.json({ ok: true });
}
