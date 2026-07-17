import { authenticateApiRequest } from "@/lib/api-keys";
import { listDeals } from "@/lib/api-v1";

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
