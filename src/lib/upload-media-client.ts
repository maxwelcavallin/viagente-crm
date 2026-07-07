export type UploadMediaKind = "imagem" | "audio" | "documento" | "video";

export function inferMediaKind(mimeType: string): UploadMediaKind {
  if (mimeType.startsWith("image/")) return "imagem";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  return "documento";
}

// Fluxo de 3 passos pra evitar o limite de payload das serverless
// functions com áudio/vídeo grandes: 1) pede URL assinada de upload,
// 2) manda o arquivo direto pro R2, 3) finaliza (gera URL assinada de
// leitura no servidor, dispara pra Z-API, grava a mensagem).
export async function uploadAndSendMedia(params: {
  file: Blob;
  contentType: string;
  fileName?: string;
  kind: UploadMediaKind;
  channelId: string;
  contactId: string;
  caption?: string;
  replyToMessageId?: string;
  replyToCreatedAt?: string;
}): Promise<void> {
  const uploadRes = await fetch("/api/messages/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      channelId: params.channelId,
      type: params.kind,
      contentType: params.contentType,
    }),
  });
  if (!uploadRes.ok) {
    const data = await uploadRes.json().catch(() => ({}));
    throw new Error(data.error ?? "Falha ao preparar upload.");
  }
  const { messageId, uploadUrl } = (await uploadRes.json()) as {
    messageId: string;
    uploadUrl: string;
  };

  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": params.contentType },
    body: params.file,
  });
  if (!putRes.ok) {
    throw new Error("Falha ao enviar o arquivo.");
  }

  const sendRes = await fetch("/api/messages/send-media", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messageId,
      channelId: params.channelId,
      contactId: params.contactId,
      type: params.kind,
      caption: params.caption,
      fileName: params.fileName,
      replyToMessageId: params.replyToMessageId,
      replyToCreatedAt: params.replyToCreatedAt,
    }),
  });
  if (!sendRes.ok) {
    const data = await sendRes.json().catch(() => ({}));
    throw new Error(data.error ?? "Falha ao enviar mídia via WhatsApp.");
  }
}
