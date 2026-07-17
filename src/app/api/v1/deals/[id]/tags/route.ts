import { authenticateApiRequest } from "@/lib/api-keys";
import { addTagToDealForApiKey } from "@/lib/api-v1";

export const dynamic = "force-dynamic";

// POST /api/v1/deals/:id/tags  { "tagId": "..." }
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { tagId?: string } | null;
  if (!body?.tagId) return Response.json({ error: "tagId é obrigatório." }, { status: 400 });

  const result = await addTagToDealForApiKey(auth.apiKey, id, body.tagId);
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });

  return Response.json(result.data);
}
