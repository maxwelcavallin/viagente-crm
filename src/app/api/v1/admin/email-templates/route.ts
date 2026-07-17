import { authenticateApiRequest } from "@/lib/api-keys";
import { createEmailTemplateForApiKey, listEmailTemplatesForApiKey } from "@/lib/api-v1-admin";

export const dynamic = "force-dynamic";

// GET /api/v1/admin/email-templates — requer chave admin
export async function GET(request: Request) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const result = await listEmailTemplatesForApiKey(auth.apiKey);
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ emailTemplates: result.data });
}

// POST /api/v1/admin/email-templates  { name, subject, content } — requer chave admin
export async function POST(request: Request) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const body = (await request.json().catch(() => null)) as {
    name?: string;
    subject?: string;
    content?: string;
  } | null;
  if (!body?.name || !body?.subject || !body?.content) {
    return Response.json({ error: "name, subject e content são obrigatórios." }, { status: 400 });
  }

  const result = await createEmailTemplateForApiKey(auth.apiKey, {
    name: body.name,
    subject: body.subject,
    content: body.content,
  });
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ emailTemplate: result.data }, { status: 201 });
}
