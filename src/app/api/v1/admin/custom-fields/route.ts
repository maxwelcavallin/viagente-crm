import { authenticateApiRequest } from "@/lib/api-keys";
import { createCustomFieldForApiKey, listCustomFieldsForApiKey } from "@/lib/api-v1-admin";

export const dynamic = "force-dynamic";

// GET /api/v1/admin/custom-fields?entity=deal|contact — requer chave admin
export async function GET(request: Request) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const entity = new URL(request.url).searchParams.get("entity") as "deal" | "contact" | null;
  const result = await listCustomFieldsForApiKey(auth.apiKey, entity ?? undefined);
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ customFields: result.data });
}

// POST /api/v1/admin/custom-fields  { entity, key, label, type, options? } — requer chave admin
export async function POST(request: Request) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const body = (await request.json().catch(() => null)) as {
    entity?: "deal" | "contact";
    key?: string;
    label?: string;
    type?: "texto" | "numero" | "select" | "data";
    options?: { value: string; label: string }[] | null;
  } | null;
  if (!body?.entity || !body?.key || !body?.label || !body?.type) {
    return Response.json({ error: "entity, key, label e type são obrigatórios." }, { status: 400 });
  }

  const result = await createCustomFieldForApiKey(auth.apiKey, {
    entity: body.entity,
    key: body.key,
    label: body.label,
    type: body.type,
    options: body.options,
  });
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ customField: result.data }, { status: 201 });
}
