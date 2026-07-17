import { authenticateApiRequest } from "@/lib/api-keys";
import { createTagForApiKey, listTagsForApiKey } from "@/lib/api-v1-admin";

export const dynamic = "force-dynamic";

// GET /api/v1/admin/tags — requer chave admin
export async function GET(request: Request) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const result = await listTagsForApiKey(auth.apiKey);
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ tags: result.data });
}

// POST /api/v1/admin/tags  { name, color? } — requer chave admin
export async function POST(request: Request) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const body = (await request.json().catch(() => null)) as { name?: string; color?: string | null } | null;
  if (!body?.name) return Response.json({ error: "name é obrigatório." }, { status: 400 });

  const result = await createTagForApiKey(auth.apiKey, { name: body.name, color: body.color });
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ tag: result.data }, { status: 201 });
}
