import { authenticateApiRequest } from "@/lib/api-keys";
import { createWebhookForApiKey, listWebhooksForApiKey } from "@/lib/api-v1-admin";

export const dynamic = "force-dynamic";

// GET /api/v1/admin/webhooks — requer chave admin (nunca inclui secretToken)
export async function GET(request: Request) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const result = await listWebhooksForApiKey(auth.apiKey);
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ webhooks: result.data });
}

// POST /api/v1/admin/webhooks — requer chave admin
// direction='entrada': { direction, name, defaultPipelineId, defaultStageId }
// direction='saida': { direction, name, targetUrl, events, pipelineId?, stageId?, tagId? }
export async function POST(request: Request) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const body = (await request.json().catch(() => null)) as {
    direction?: "entrada" | "saida";
    name?: string;
    defaultPipelineId?: string | null;
    defaultStageId?: string | null;
    targetUrl?: string | null;
    events?: string[];
    pipelineId?: string | null;
    stageId?: string | null;
    tagId?: string | null;
  } | null;
  if (!body?.direction || !body?.name) {
    return Response.json({ error: "direction e name são obrigatórios." }, { status: 400 });
  }

  const result = await createWebhookForApiKey(auth.apiKey, {
    direction: body.direction,
    name: body.name,
    defaultPipelineId: body.defaultPipelineId,
    defaultStageId: body.defaultStageId,
    targetUrl: body.targetUrl,
    events: body.events,
    pipelineId: body.pipelineId,
    stageId: body.stageId,
    tagId: body.tagId,
  });
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ webhook: result.data }, { status: 201 });
}
