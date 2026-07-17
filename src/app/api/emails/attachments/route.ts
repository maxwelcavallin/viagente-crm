import { auth } from "@/auth";
import { getMediaSignedUrl } from "@/lib/storage";

export const dynamic = "force-dynamic";

// Proxy de download pros anexos de email já enviados (histórico do
// negócio) — mesmo raciocínio de /api/media/[messageId]: nunca gravamos
// link público permanente do R2, só uma URL assinada de curta duração.
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Não autenticado" }, { status: 401 });
  }

  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  if (!key || !key.startsWith("email-attachments/")) {
    return Response.json({ error: "Anexo não encontrado" }, { status: 404 });
  }

  try {
    const downloadFileName = key.split("/").pop();
    const signedUrl = await getMediaSignedUrl(key, { downloadFileName });
    return Response.redirect(signedUrl, 302);
  } catch (error) {
    console.error("[email attachments proxy] falha ao gerar URL assinada", error);
    return Response.json({ error: "Anexo expirado ou indisponível" }, { status: 404 });
  }
}
