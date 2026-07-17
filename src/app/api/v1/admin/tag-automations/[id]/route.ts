import { authenticateApiRequest } from "@/lib/api-keys";
import { deleteTagAutomationForApiKey, updateTagAutomationForApiKey } from "@/lib/api-v1-admin";

export const dynamic = "force-dynamic";

// PATCH /api/v1/admin/tag-automations/:id — requer chave admin (mesmos campos do POST)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as {
    tagId?: string;
    title?: string;
    type?: "mensagem" | "ligacao" | "agendamento" | "generica" | "email";
    trigger?: "tag_adicionada" | "dias_apos_tag";
    delayMinutes?: number | null;
    messageTemplateId?: string | null;
    autoSend?: boolean;
    autoSendChannelId?: string | null;
  } | null;
  if (!body?.tagId || !body?.title || !body?.type || !body?.trigger) {
    return Response.json({ error: "tagId, title, type e trigger são obrigatórios." }, { status: 400 });
  }

  const result = await updateTagAutomationForApiKey(auth.apiKey, id, {
    tagId: body.tagId,
    title: body.title,
    type: body.type,
    trigger: body.trigger,
    delayMinutes: body.delayMinutes,
    messageTemplateId: body.messageTemplateId,
    autoSend: body.autoSend,
    autoSendChannelId: body.autoSendChannelId,
  });
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ tagAutomation: result.data });
}

// DELETE /api/v1/admin/tag-automations/:id — requer chave admin
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const result = await deleteTagAutomationForApiKey(auth.apiKey, id);
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json(result.data);
}
