import { runMeetingNotesSync } from "@/lib/meeting-notes-sync";

export const dynamic = "force-dynamic";

// Roda uma vez por dia (ver vercel.json), mesmo guard de CRON_SECRET de
// /api/cron/task-automation. Sincronização de notas do Gemini não é
// tempo-crítica — janela de LOOKBACK_DAYS + dedupe por drive_file_id cobre
// atrasos na geração do doc pelo Gemini e execuções repetidas.
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Não autorizado" }, { status: 401 });
  }

  const result = await runMeetingNotesSync();
  return Response.json(result);
}
