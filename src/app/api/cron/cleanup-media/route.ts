import { and, lt, isNotNull, or, eq } from "drizzle-orm";
import { db } from "@/db";
import { messages } from "@/db/schema";

export const dynamic = "force-dynamic";

const RETENTION_DAYS = 120;

// Espelha a lifecycle rule do bucket R2 (prefixo "media/" expira em 120
// dias; "audio/" nunca expira) — sem isso o media_url ficaria apontando pra
// um objeto já deletado no R2, quebrando o link em vez de mostrar "mídia
// expirada". Agendado via Vercel Cron (ver vercel.json), protegido por
// CRON_SECRET.
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Não autorizado" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

  const result = await db
    .update(messages)
    .set({ mediaUrl: null })
    .where(
      and(
        or(eq(messages.type, "imagem"), eq(messages.type, "video"), eq(messages.type, "documento")),
        isNotNull(messages.mediaUrl),
        lt(messages.createdAt, cutoff)
      )
    )
    .returning({ id: messages.id });

  return Response.json({ cleaned: result.length });
}
