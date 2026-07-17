import { authenticateApiRequest } from "@/lib/api-keys";
import { deleteStageForApiKey, updateStageForApiKey } from "@/lib/api-v1-admin";

export const dynamic = "force-dynamic";

// PATCH /api/v1/admin/stages/:id  { name, color? } — requer chave admin
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { name?: string; color?: string | null } | null;
  if (!body?.name) return Response.json({ error: "name é obrigatório." }, { status: 400 });

  const result = await updateStageForApiKey(auth.apiKey, id, { name: body.name, color: body.color });
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ stage: result.data });
}

// DELETE /api/v1/admin/stages/:id — requer chave admin
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const result = await deleteStageForApiKey(auth.apiKey, id);
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json(result.data);
}
