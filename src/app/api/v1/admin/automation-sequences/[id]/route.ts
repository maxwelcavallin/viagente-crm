import { authenticateApiRequest } from "@/lib/api-keys";
import {
  deleteAutomationSequenceForApiKey,
  getAutomationSequenceForApiKey,
  updateAutomationSequenceForApiKey,
} from "@/lib/api-v1-admin";

export const dynamic = "force-dynamic";

// GET /api/v1/admin/automation-sequences/:id — requer chave admin (inclui steps)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const result = await getAutomationSequenceForApiKey(auth.apiKey, id);
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json(result.data);
}

// PATCH /api/v1/admin/automation-sequences/:id — requer chave admin (mesmos campos do POST, steps substitui tudo)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body?.name || !body?.triggerType || !Array.isArray(body?.steps)) {
    return Response.json({ error: "name, triggerType e steps são obrigatórios." }, { status: 400 });
  }

  const result = await updateAutomationSequenceForApiKey(auth.apiKey, id, body);
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ automationSequence: result.data });
}

// DELETE /api/v1/admin/automation-sequences/:id — requer chave admin
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const result = await deleteAutomationSequenceForApiKey(auth.apiKey, id);
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json(result.data);
}
