import { authenticateApiRequest } from "@/lib/api-keys";
import { createStageTaskForApiKey, listStageTasksForApiKey } from "@/lib/api-v1-admin";

export const dynamic = "force-dynamic";

// GET /api/v1/admin/stage-tasks?stageId=... — requer chave admin
export async function GET(request: Request) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const stageId = new URL(request.url).searchParams.get("stageId");
  if (!stageId) return Response.json({ error: "stageId é obrigatório." }, { status: 400 });

  const result = await listStageTasksForApiKey(auth.apiKey, stageId);
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ stageTasks: result.data });
}

// POST /api/v1/admin/stage-tasks — requer chave admin
// { stageId, title, type, messageTemplateId?, emailTemplateId?, daysToComplete?,
//   triggerDelayMinutes?, isAutomatic?, autoSend?, autoSendChannelId? }
export async function POST(request: Request) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const body = (await request.json().catch(() => null)) as {
    stageId?: string;
    title?: string;
    type?: "mensagem" | "ligacao" | "agendamento" | "generica" | "email";
    messageTemplateId?: string | null;
    emailTemplateId?: string | null;
    daysToComplete?: number | null;
    triggerDelayMinutes?: number | null;
    isAutomatic?: boolean;
    autoSend?: boolean;
    autoSendChannelId?: string | null;
  } | null;
  if (!body?.stageId || !body?.title || !body?.type) {
    return Response.json({ error: "stageId, title e type são obrigatórios." }, { status: 400 });
  }

  const result = await createStageTaskForApiKey(auth.apiKey, {
    stageId: body.stageId,
    title: body.title,
    type: body.type,
    messageTemplateId: body.messageTemplateId,
    emailTemplateId: body.emailTemplateId,
    daysToComplete: body.daysToComplete,
    triggerDelayMinutes: body.triggerDelayMinutes,
    isAutomatic: body.isAutomatic,
    autoSend: body.autoSend,
    autoSendChannelId: body.autoSendChannelId,
  });
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ stageTask: result.data }, { status: 201 });
}
