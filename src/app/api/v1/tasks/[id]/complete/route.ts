import { authenticateApiRequest } from "@/lib/api-keys";
import { completeTaskForApiKey } from "@/lib/api-v1";

export const dynamic = "force-dynamic";

// POST /api/v1/tasks/:id/complete
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const result = await completeTaskForApiKey(auth.apiKey, id);
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });

  return Response.json({ task: result.data });
}
