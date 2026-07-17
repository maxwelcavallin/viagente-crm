import { authenticateApiRequest } from "@/lib/api-keys";
import { moveDealStageForApiKey } from "@/lib/api-v1";

export const dynamic = "force-dynamic";

// POST /api/v1/deals/:id/move-stage  { "stageId": "..." }
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { stageId?: string } | null;
  if (!body?.stageId) {
    return Response.json({ error: "stageId é obrigatório." }, { status: 400 });
  }

  const result = await moveDealStageForApiKey(auth.apiKey, id, body.stageId);
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });

  return Response.json({ deal: result.data });
}
