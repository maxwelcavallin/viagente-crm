import { authenticateApiRequest } from "@/lib/api-keys";
import { deleteWebhookForApiKey, updateWebhookForApiKey } from "@/lib/api-v1-admin";

export const dynamic = "force-dynamic";

// PATCH /api/v1/admin/webhooks/:id — requer chave admin (mesmos campos do POST)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as {
    direction?: "entrada" | "saida";
    name?: string;
    defaultPipelineId?: string | null;
    defaultStageId?: string | null;
    targetUrl?: string | null;
    events?: string[];
    pipelineId?: string | null;
    stageId?: string | null;
  } | null;
  if (!body?.direction || !body?.name) {
    return Response.json({ error: "direction e name são obrigatórios." }, { status: 400 });
  }

  const result = await updateWebhookForApiKey(auth.apiKey, id, {
    direction: body.direction,
    name: body.name,
    defaultPipelineId: body.defaultPipelineId,
    defaultStageId: body.defaultStageId,
    targetUrl: body.targetUrl,
    events: body.events,
    pipelineId: body.pipelineId,
    stageId: body.stageId,
  });
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ webhook: result.data });
}

// DELETE /api/v1/admin/webhooks/:id — requer chave admin
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const result = await deleteWebhookForApiKey(auth.apiKey, id);
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json(result.data);
}
