import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { contacts, messages, whatsappChannels } from "@/db/schema";
import { userHasChannelAccess } from "@/lib/channel-access";
import { decryptCredential } from "@/lib/credentials-crypto";
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
  if (!contact.phone) {
    return Response.json(
      { error: "Contato não tem telefone (WhatsApp)" },
      { status: 400 }
    );
  }

  const type = body.type as MediaKind;
  const key = `${mediaPrefix(type)}/${channel.id}/${body.messageId}`;

  let externalMessageId: string;
  try {
    const signedUrl = await getMediaSignedUrl(key, { expiresInSeconds: 300 });
    const { messageId } = await dispatchToZapi(
      type,
      {
        zapiInstanceId: channel.zapiInstanceId,
        zapiToken: decryptCredential(channel.zapiToken),
        zapiClientToken: decryptCredential(channel.zapiClientToken),
      },
      contact.phone,
      signedUrl,
      body.caption?.trim() || undefined,
      body.fileName || undefined
    );
    externalMessageId = messageId;
  } catch (error) {
    console.error("[messages/send-media] falha ao enviar via Z-API", error);
    return Response.json(
      { error: "Falha ao enviar mídia via WhatsApp" },
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
      channelType: "whatsapp",
      externalMessageId,
      replyToMessageId: body.replyToMessageId || null,
      replyToCreatedAt: body.replyToCreatedAt
        ? new Date(body.replyToCreatedAt)
        : null,
    })
    .returning();

  return Response.json({ message: created });
}
