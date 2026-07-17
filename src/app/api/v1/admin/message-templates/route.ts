import { authenticateApiRequest } from "@/lib/api-keys";
import { createMessageTemplateForApiKey, listMessageTemplatesForApiKey } from "@/lib/api-v1-admin";

export const dynamic = "force-dynamic";

// GET /api/v1/admin/message-templates — requer chave admin
export async function GET(request: Request) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const result = await listMessageTemplatesForApiKey(auth.apiKey);
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ messageTemplates: result.data });
}

// POST /api/v1/admin/message-templates  { name, content } — requer chave admin
export async function POST(request: Request) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const body = (await request.json().catch(() => null)) as { name?: string; content?: string } | null;
  if (!body?.name || !body?.content) {
    return Response.json({ error: "name e content são obrigatórios." }, { status: 400 });
  }

  const result = await createMessageTemplateForApiKey(auth.apiKey, { name: body.name, content: body.content });
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ messageTemplate: result.data }, { status: 201 });
}
