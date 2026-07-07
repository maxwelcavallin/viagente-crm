import { randomUUID } from "node:crypto";
import { auth } from "@/auth";
import { userHasChannelAccess } from "@/lib/channel-access";
import { getMediaUploadUrl, mediaPrefix, type MediaKind } from "@/lib/storage";

export const dynamic = "force-dynamic";

const VALID_TYPES: MediaKind[] = ["imagem", "audio", "documento", "video"];

// Emite uma URL assinada de PUT direto pro R2 — o arquivo (imagem, vídeo,
// áudio gravado, documento) vai do navegador direto pro bucket, sem passar
// pela serverless function, evitando o limite de payload do runtime.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Não autenticado" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    channelId?: string;
    type?: string;
    contentType?: string;
  } | null;

  if (
    !body?.channelId ||
    !body?.type ||
    !VALID_TYPES.includes(body.type as MediaKind) ||
    !body?.contentType
  ) {
    return Response.json(
      { error: "channelId, type e contentType são obrigatórios" },
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

  const messageId = randomUUID();
  const type = body.type as MediaKind;
  const key = `${mediaPrefix(type)}/${body.channelId}/${messageId}`;

  const uploadUrl = await getMediaUploadUrl(key, body.contentType);

  return Response.json({ messageId, uploadUrl });
}
