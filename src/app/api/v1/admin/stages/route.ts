import { authenticateApiRequest } from "@/lib/api-keys";
import { createStageForApiKey, listStagesForApiKey } from "@/lib/api-v1-admin";

export const dynamic = "force-dynamic";

// GET /api/v1/admin/stages?pipelineId=... — requer chave admin
export async function GET(request: Request) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const pipelineId = new URL(request.url).searchParams.get("pipelineId");
  if (!pipelineId) return Response.json({ error: "pipelineId é obrigatório." }, { status: 400 });

  const result = await listStagesForApiKey(auth.apiKey, pipelineId);
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ stages: result.data });
}

// POST /api/v1/admin/stages  { pipelineId, name, color? } — requer chave admin
export async function POST(request: Request) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const body = (await request.json().catch(() => null)) as {
    pipelineId?: string;
    name?: string;
    color?: string | null;
  } | null;
  if (!body?.pipelineId || !body?.name) {
    return Response.json({ error: "pipelineId e name são obrigatórios." }, { status: 400 });
  }

  const result = await createStageForApiKey(auth.apiKey, {
    pipelineId: body.pipelineId,
    name: body.name,
    color: body.color,
  });
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ stage: result.data }, { status: 201 });
}
