import { authenticateApiRequest } from "@/lib/api-keys";
import { getDeal, updateDealForApiKey } from "@/lib/api-v1";

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

// PATCH /api/v1/deals/:id  { title?, ownerId?, value?, stageId?, customFields?, status?, lossReasonId? }
// status "perdido" exige lossReasonId (motivo cadastrado na pipeline do negócio).
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as {
    title?: string;
    ownerId?: string | null;
    value?: string | null;
    stageId?: string;
    customFields?: Record<string, unknown>;
    status?: "aberto" | "ganho" | "perdido";
    lossReasonId?: string;
  } | null;
  if (!body) return Response.json({ error: "Corpo inválido." }, { status: 400 });

  const result = await updateDealForApiKey(auth.apiKey, id, body);
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });

  return Response.json({ deal: result.data });
}
