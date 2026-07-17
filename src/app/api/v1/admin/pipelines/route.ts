import { authenticateApiRequest } from "@/lib/api-keys";
import { createPipelineForApiKey, listPipelinesForApiKey } from "@/lib/api-v1-admin";

export const dynamic = "force-dynamic";

// GET /api/v1/admin/pipelines — requer chave admin
export async function GET(request: Request) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const result = await listPipelinesForApiKey(auth.apiKey);
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ pipelines: result.data });
}

// POST /api/v1/admin/pipelines  { "name": "..." } — requer chave admin
export async function POST(request: Request) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const body = (await request.json().catch(() => null)) as { name?: string } | null;
  if (!body?.name) return Response.json({ error: "name é obrigatório." }, { status: 400 });

  const result = await createPipelineForApiKey(auth.apiKey, { name: body.name });
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ pipeline: result.data }, { status: 201 });
}
