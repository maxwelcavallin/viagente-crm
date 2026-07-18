import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { contacts, instagramChannels, messages, whatsappChannels } from "@/db/schema";
import { userHasChannelAccess } from "@/lib/channel-access";
import { decryptCredential } from "@/lib/credentials-crypto";
import { sendInstagramAttachment } from "@/lib/instagram-graph";
import { findOpenDealIdForContact } from "@/lib/messaging";
import { getMediaSignedUrl, mediaPrefix, type MediaKind } from "@/lib/storage";
import {
  sendZapiAudio,
  sendZapiDocument,
  sendZapiImage,
  sendZapiVideo,
  type ZapiChannelCredentials,
} from "@/lib/zapi";

export const dynamic = "force-dynamic";

const VALID_TYPES: MediaKind[] = ["imagem", "audio", "documento", "video"];

// Instagram Messaging não tem tipo "document" (ver sendInstagramAttachment).
const INSTAGRAM_ATTACHMENT_TYPE: Partial<Record<MediaKind, "image" | "video" | "audio">> = {
  imagem: "image",
  video: "video",
  audio: "audio",
};

function extensionFromFileName(fileName: string): string {
  const ext = fileName.split(".").pop();
  return ext && ext !== fileName ? ext.toLowerCase() : "bin";
}

async function dispatchToZapi(
  type: MediaKind,
  creds: ZapiChannelCredentials,
  phone: string,
  mediaUrl: string,
  caption: string | undefined,
  fileName: string | undefined
): Promise<{ messageId: string }> {
  if (type === "imagem") return sendZapiImage(creds, phone, mediaUrl, caption);
  if (type === "video") return sendZapiVideo(creds, phone, mediaUrl, caption);
  if (type === "audio") return sendZapiAudio(creds, phone, mediaUrl);
  return sendZapiDocument(
    creds,
    phone,
    mediaUrl,
    extensionFromFileName(fileName ?? "arquivo.bin"),
    fileName
  );
}

// Finaliza o envio de mídia: o arquivo já foi enviado pro R2 direto pelo
// navegador via a URL assinada de /api/messages/upload-url. Aqui geramos uma
// URL assinada de leitura (curta duração) pra Z-API buscar o arquivo,
// disparamos o envio e só então gravamos a mensagem no banco.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Não autenticado" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    messageId?: string;
    channelId?: string;
    contactId?: string;
    type?: string;
    caption?: string;
    fileName?: string;
    replyToMessageId?: string;
    replyToCreatedAt?: string;
  } | null;

  if (
    !body?.messageId ||
    !body?.channelId ||
    !body?.contactId ||
    !body?.type ||
    !VALID_TYPES.includes(body.type as MediaKind)
  ) {
    return Response.json(
      {
        error: "messageId, channelId, contactId e type são obrigatórios",
      },
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

  // channelId não é FK'd a uma tabela só (canal pode ser WhatsApp OU
  // Instagram, ver Etapa 25) — tenta achar nas duas.
  const [[whatsappChannel], [instagramChannel]] = await Promise.all([
    db.select().from(whatsappChannels).where(eq(whatsappChannels.id, body.channelId)).limit(1),
    db.select().from(instagramChannels).where(eq(instagramChannels.id, body.channelId)).limit(1),
  ]);
  const channel = whatsappChannel ?? instagramChannel;
  if (!channel) {
    return Response.json({ error: "Canal não encontrado" }, { status: 404 });
  }
  const channelType: "whatsapp" | "instagram" = whatsappChannel ? "whatsapp" : "instagram";

  const type = body.type as MediaKind;
  if (channelType === "instagram" && !INSTAGRAM_ATTACHMENT_TYPE[type]) {
    return Response.json(
      { error: "Instagram não suporta envio de documentos — só imagem, vídeo e áudio" },
      { status: 400 }
    );
  }

  const [contact] = await db
    .select({ id: contacts.id, phone: contacts.phone, instagramUserId: contacts.instagramUserId })
    .from(contacts)
    .where(eq(contacts.id, body.contactId))
    .limit(1);
  if (!contact) {
    return Response.json({ error: "Contato não encontrado" }, { status: 404 });
  }
  if (channelType === "whatsapp" && !contact.phone) {
    return Response.json(
      { error: "Contato não tem telefone (WhatsApp)" },
      { status: 400 }
    );
  }
  if (channelType === "instagram" && !contact.instagramUserId) {
    return Response.json(
      { error: "Contato não tem conta do Instagram vinculada" },
      { status: 400 }
    );
  }

  const key = `${mediaPrefix(type)}/${channel.id}/${body.messageId}`;

  let externalMessageId: string;
  try {
    const signedUrl = await getMediaSignedUrl(key, { expiresInSeconds: 300 });
    if (channelType === "instagram") {
      const { messageId } = await sendInstagramAttachment(
        decryptCredential(instagramChannel.accessToken),
        contact.instagramUserId!,
        INSTAGRAM_ATTACHMENT_TYPE[type]!,
        signedUrl
      );
      externalMessageId = messageId;
    } else {
      const { messageId } = await dispatchToZapi(
        type,
        {
          zapiInstanceId: whatsappChannel.zapiInstanceId,
          zapiToken: decryptCredential(whatsappChannel.zapiToken),
          zapiClientToken: decryptCredential(whatsappChannel.zapiClientToken),
        },
        contact.phone!,
        signedUrl,
        body.caption?.trim() || undefined,
        body.fileName || undefined
      );
      externalMessageId = messageId;
    }
  } catch (error) {
    console.error(`[messages/send-media] falha ao enviar via ${channelType}`, error);
    return Response.json(
      { error: `Falha ao enviar mídia via ${channelType === "instagram" ? "Instagram" : "WhatsApp"}` },
      { status: 502 }
    );
  }

  const dealId = await findOpenDealIdForContact(contact.id);

  const [created] = await db
    .insert(messages)
    .values({
      id: body.messageId,
      dealId,
      contactId: contact.id,
      channelId: channel.id,
      direction: "saida",
      type,
      content: body.caption?.trim() || body.fileName || null,
      mediaUrl: `/api/media/${body.messageId}`,
      status: "enviado",
      channelType,
      externalMessageId,
      replyToMessageId: body.replyToMessageId || null,
      replyToCreatedAt: body.replyToCreatedAt
        ? new Date(body.replyToCreatedAt)
        : null,
    })
    .returning();

  return Response.json({ message: created });
}
