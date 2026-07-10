import { runDelayedAutomationSweep } from "@/lib/task-automation";

export const dynamic = "force-dynamic";

// Roda de hora em hora (ver vercel.json), protegido por CRON_SECRET — mesmo
// padrão de /api/cron/send-scheduled-messages. Cobre os dois gatilhos com
// atraso (dias na etapa, dias com a tag) e o auto-send de tasks pendentes
// cujo prazo já venceu; os gatilhos imediatos (entrada de etapa, tag
// adicionada) já disparam na hora, direto nas actions que os originam.
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Não autorizado" }, { status: 401 });
  }

  const result = await runDelayedAutomationSweep();
  return Response.json(result);
}
