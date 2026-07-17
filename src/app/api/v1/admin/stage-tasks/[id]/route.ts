import { authenticateApiRequest } from "@/lib/api-keys";
import { deleteStageTaskForApiKey, updateStageTaskForApiKey } from "@/lib/api-v1-admin";

export const dynamic = "force-dynamic";

// PATCH /api/v1/admin/stage-tasks/:id — requer chave admin
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as {
    title?: string;
    messageTemplateId?: string | null;
    emailTemplateId?: string | null;
    daysToComplete?: number | null;
    triggerDelayMinutes?: number | null;
    isAutomatic?: boolean;
    autoSend?: boolean;
    autoSendChannelId?: string | null;
  } | null;
  if (!body?.title) return Response.json({ error: "title é obrigatório." }, { status: 400 });

  const result = await updateStageTaskForApiKey(auth.apiKey, id, {
    title: body.title,
    messageTemplateId: body.messageTemplateId,
    emailTemplateId: body.emailTemplateId,
    daysToComplete: body.daysToComplete,
    triggerDelayMinutes: body.triggerDelayMinutes,
    isAutomatic: body.isAutomatic,
    autoSend: body.autoSend,
    autoSendChannelId: body.autoSendChannelId,
  });
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ stageTask: result.data });
}

// DELETE /api/v1/admin/stage-tasks/:id — requer chave admin
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const result = await deleteStageTaskForApiKey(auth.apiKey, id);
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json(result.data);
}
