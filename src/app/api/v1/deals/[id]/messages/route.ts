import { authenticateApiRequest } from "@/lib/api-keys";
import { getDealConversation } from "@/lib/api-v1";

export const dynamic = "force-dynamic";

// GET /api/v1/deals/:id/messages — histórico de conversa do contato do negócio.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const result = await getDealConversation(auth.apiKey.actingUser, id);
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });

  return Response.json({ messages: result.data });
}
