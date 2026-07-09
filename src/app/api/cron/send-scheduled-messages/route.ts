import { and, eq, lte } from "drizzle-orm";
import { db } from "@/db";
import { scheduledMessages } from "@/db/schema";
import { sendTextMessage } from "@/lib/send-message";

export const dynamic = "force-dynamic";

// Roda a cada minuto (ver vercel.json), protegido por CRON_SECRET. Cada
// mensagem due é enviada via o mesmo caminho de /api/messages/send —
// sucesso grava em "messages" e marca "enviada"; falha marca "erro" sem
// derrubar as demais mensagens due no mesmo ciclo.
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Não autorizado" }, { status: 401 });
  }

  const due = await db
    .select()
    .from(scheduledMessages)
    .where(
      and(
        eq(scheduledMessages.status, "pendente"),
        lte(scheduledMessages.scheduledAt, new Date())
      )
    );

  let sent = 0;
  let failed = 0;

  for (const item of due) {
    const result = await sendTextMessage({
      channelId: item.channelId,
      contactId: item.contactId,
      message: item.content,
    });

    if (result.ok) {
      sent += 1;
      await db
        .update(scheduledMessages)
        .set({ status: "enviada", sentAt: new Date() })
        .where(eq(scheduledMessages.id, item.id));
    } else {
      failed += 1;
      console.error(
        `[cron/send-scheduled-messages] falha ao enviar ${item.id}: ${result.error}`
      );
      await db
        .update(scheduledMessages)
        .set({ status: "erro", errorMessage: result.error })
        .where(eq(scheduledMessages.id, item.id));
    }
  }

  return Response.json({ due: due.length, sent, failed });
}
