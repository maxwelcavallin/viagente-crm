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

// URL assinada de upload direto (PUT) — usada pelo composer do atendimento
// pra mandar anexos/áudio gravado direto do navegador pro R2, sem passar o
// arquivo pela serverless function (evita o limite de payload do runtime).
export async function getMediaUploadUrl(
  key: string,
  contentType: string,
  expiresInSeconds = 600
): Promise<string> {
  const client = getClient();
  const command = new PutObjectCommand({
    Bucket: bucketName(),
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

// URL assinada de curta duração — nunca gravamos link público permanente do
// R2 no banco, pra poder aplicar o controle de acesso por canal também na
// mídia (ver /api/media/[messageId]).
// `downloadFileName` força o header Content-Disposition: attachment — sem
// isso o navegador abre imagem/vídeo inline em vez de baixar (o bucket R2
// não expõe Content-Disposition próprio).
export async function getMediaSignedUrl(
  key: string,
  options?: { expiresInSeconds?: number; downloadFileName?: string }
): Promise<string> {
  const client = getClient();
  const command = new GetObjectCommand({
    Bucket: bucketName(),
    Key: key,
    ...(options?.downloadFileName
      ? {
          ResponseContentDisposition: `attachment; filename="${options.downloadFileName.replace(/"/g, "")}"`,
        }
      : {}),
  });
  return getSignedUrl(client, command, {
    expiresIn: options?.expiresInSeconds ?? 300,
  });
}
