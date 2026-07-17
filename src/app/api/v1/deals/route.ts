import { authenticateApiRequest } from "@/lib/api-keys";
import { createDealForApiKey, listDeals } from "@/lib/api-v1";

export const dynamic = "force-dynamic";

// GET /api/v1/deals?pipelineId=&stageId=&ownerId=(uuid|me|unassigned)&status=&temperature=&tagId=&search=&limit=&offset=
export async function GET(request: Request) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const url = new URL(request.url);
  const params = url.searchParams;
  const limitRaw = params.get("limit");
  const offsetRaw = params.get("offset");

  const deals = await listDeals(auth.apiKey.actingUser, {
    pipelineId: params.get("pipelineId") ?? undefined,
    stageId: params.get("stageId") ?? undefined,
    ownerId: params.get("ownerId") ?? undefined,
    status: (params.get("status") as "aberto" | "ganho" | "perdido" | null) ?? undefined,
    temperature: (params.get("temperature") as "quente" | "morno" | "frio" | null) ?? undefined,
    tagId: params.get("tagId") ?? undefined,
    search: params.get("search") ?? undefined,
    limit: limitRaw ? Number(limitRaw) : undefined,
    offset: offsetRaw ? Number(offsetRaw) : undefined,
  });

  return Response.json({ deals });
}

// POST /api/v1/deals  { contactId, pipelineId, stageId, title?, ownerId?, value?, customFields?, tagIds? }
export async function POST(request: Request) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const body = (await request.json().catch(() => null)) as {
    contactId?: string;
    pipelineId?: string;
    stageId?: string;
    title?: string;
    ownerId?: string | null;
    value?: string | null;
    customFields?: Record<string, unknown>;
    tagIds?: string[];
  } | null;
  if (!body?.contactId || !body?.pipelineId || !body?.stageId) {
    return Response.json({ error: "contactId, pipelineId e stageId são obrigatórios." }, { status: 400 });
  }

  const result = await createDealForApiKey(auth.apiKey, {
    contactId: body.contactId,
    pipelineId: body.pipelineId,
    stageId: body.stageId,
    title: body.title,
    ownerId: body.ownerId,
    value: body.value,
    customFields: body.customFields,
    tagIds: body.tagIds,
  });
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });

  return Response.json({ deal: result.data }, { status: 201 });
}
