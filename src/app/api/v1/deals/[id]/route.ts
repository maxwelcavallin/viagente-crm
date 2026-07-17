import { authenticateApiRequest } from "@/lib/api-keys";
import { getDeal } from "@/lib/api-v1";

export const dynamic = "force-dynamic";

// GET /api/v1/deals/:id
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const deal = await getDeal(auth.apiKey.actingUser, id);
  if (!deal) return Response.json({ error: "Negócio não encontrado." }, { status: 404 });

  return Response.json({ deal });
}
