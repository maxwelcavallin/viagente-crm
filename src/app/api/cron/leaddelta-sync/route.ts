import { runLeadDeltaSync } from "@/lib/leaddelta-sync";

// Roda uma vez por dia às 23h59 horário de Brasília — schedule em vercel.json
// é "59 2 * * *" (UTC), já convertido de UTC-3. Mesmo guard de CRON_SECRET
// de /api/cron/task-automation. Reaproveita a mesma lógica do botão
// "Sincronizar agora" em /configuracoes/linkedin (src/lib/leaddelta-sync.ts).
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Não autorizado" }, { status: 401 });
  }

  const result = await runLeadDeltaSync();
  return Response.json(result);
}
