import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function getClient(): S3Client {
  const endpoint = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error("Variáveis de ambiente do R2 não configuradas");
  }
  return new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  });
}

function bucketName(): string {
  const bucket = process.env.R2_BUCKET;
  if (!bucket) throw new Error("R2_BUCKET não está definida");
  return bucket;
}

export type MediaKind = "imagem" | "audio" | "documento" | "video";

// "audio/" nunca expira; "media/" (imagem, documento, vídeo) expira em 120
// dias via lifecycle rule configurada direto no bucket R2 (sem código aqui).
export function mediaPrefix(kind: MediaKind): "audio" | "media" {
  return kind === "audio" ? "audio" : "media";
}

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "audio/ogg": "ogg",
  "audio/ogg; codecs=opus": "ogg",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "video/mp4": "mp4",
  "application/pdf": "pdf",
};

export function extensionForMimeType(mimeType: string | undefined): string {
  if (!mimeType) return "bin";
  return EXTENSION_BY_MIME[mimeType] ?? mimeType.split("/")[1]?.split(";")[0] ?? "bin";
}

export async function uploadMediaToR2(params: {
  key: string;
  body: Buffer;
  contentType: string;
}): Promise<void> {
  const client = getClient();
  await client.send(
    new PutObjectCommand({
      Bucket: bucketName(),
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType,
    })
  );
}

// URL assinada de curta duração — nunca gravamos link público permanente do
// R2 no banco, pra poder aplicar o controle de acesso por canal também na
// mídia (ver /api/media/[messageId]).
export async function getMediaSignedUrl(
  key: string,
  expiresInSeconds = 300
): Promise<string> {
  const client = getClient();
  const command = new GetObjectCommand({ Bucket: bucketName(), Key: key });
  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}
