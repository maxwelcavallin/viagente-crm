import { runSequenceSweep } from "@/lib/automation-sequences";
import { refreshExpiringInstagramTokens } from "@/lib/instagram-graph";
import { runOverdueTaskNotifications } from "@/lib/notifications";
import { runNpsSweep } from "@/lib/nps";
import { runDelayedAutomationSweep } from "@/lib/task-automation";

export const dynamic = "force-dynamic";

// Roda de hora em hora (ver vercel.json), protegido por CRON_SECRET — mesmo
// padrão de /api/cron/send-scheduled-messages. Cobre os dois gatilhos com
// atraso da Etapa 13 (dias na etapa, dias com a tag) e o auto-send de tasks
// pendentes cujo prazo já venceu; os gatilhos imediatos (entrada de etapa,
// tag adicionada) já disparam na hora, direto nas actions que os originam.
// Também roda a varredura de automation_sequences (Etapa 22): detecta o
// gatilho 'sem_resposta' e avança os passos de sequências já em andamento
// cujo próximo passo já venceu. A notificação de tarefa vencida (Etapa
// 23), com dedupe pra não repetir a cada execução. E o envio de pesquisa
// NPS pós-venda (Etapa 27) — mesmo raciocínio de reavaliar o estado atual
// a cada execução em vez de agendar um "pendente" à parte. E a renovação de
// tokens do Instagram (Etapa 25, Instagram API with Instagram Login) que
// estejam perto de vencer — token de 60 dias, ver refreshExpiringInstagramTokens.
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Não autorizado" }, { status: 401 });
  }

  const [delayedAutomations, sequences, overdueTaskNotifications, nps, instagramTokens] =
    await Promise.all([
      runDelayedAutomationSweep(),
      runSequenceSweep(),
      runOverdueTaskNotifications(),
      runNpsSweep(),
      refreshExpiringInstagramTokens(),
    ]);
  return Response.json({
    ...delayedAutomations,
    sequences,
    overdueTaskNotifications,
    nps,
    instagramTokens,
  });
}
