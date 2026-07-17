import { authenticateApiRequest } from "@/lib/api-keys";
import { removeTagFromDealForApiKey } from "@/lib/api-v1";

export const dynamic = "force-dynamic";

// DELETE /api/v1/deals/:id/tags/:tagId
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; tagId: string }> }
) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const { id, tagId } = await params;
  const result = await removeTagFromDealForApiKey(auth.apiKey, id, tagId);
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });

  return Response.json(result.data);
}
