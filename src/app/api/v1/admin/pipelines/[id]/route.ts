import { authenticateApiRequest } from "@/lib/api-keys";
import { deletePipelineForApiKey, updatePipelineForApiKey } from "@/lib/api-v1-admin";

export const dynamic = "force-dynamic";

// PATCH /api/v1/admin/pipelines/:id  { "name": "..." } — requer chave admin
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { name?: string } | null;
  if (!body?.name) return Response.json({ error: "name é obrigatório." }, { status: 400 });

  const result = await updatePipelineForApiKey(auth.apiKey, id, { name: body.name });
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ pipeline: result.data });
}

// DELETE /api/v1/admin/pipelines/:id — requer chave admin
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const result = await deletePipelineForApiKey(auth.apiKey, id);
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json(result.data);
}
