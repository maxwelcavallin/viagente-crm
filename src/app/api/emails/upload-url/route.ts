import { randomUUID } from "node:crypto";
import { auth } from "@/auth";
import { getMediaUploadUrl } from "@/lib/storage";

export const dynamic = "force-dynamic";

// Mesmo padrão de /api/messages/upload-url (URL assinada de PUT direto pro
// R2, arquivo nunca passa pela serverless function) — anexos de email não
// são por canal, só exigem sessão autenticada.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Não autenticado" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    filename?: string;
    contentType?: string;
  } | null;

  if (!body?.filename || !body?.contentType) {
    return Response.json({ error: "filename e contentType são obrigatórios" }, { status: 400 });
  }

  const safeFilename = body.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = `email-attachments/${randomUUID()}-${safeFilename}`;
  const uploadUrl = await getMediaUploadUrl(key, body.contentType);

  return Response.json({ key, uploadUrl });
}
