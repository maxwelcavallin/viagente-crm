import { authenticateApiRequest } from "@/lib/api-keys";
import { deleteEmailTemplateForApiKey, updateEmailTemplateForApiKey } from "@/lib/api-v1-admin";

export const dynamic = "force-dynamic";

// PATCH /api/v1/admin/email-templates/:id  { name, subject, content } — requer chave admin
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as {
    name?: string;
    subject?: string;
    content?: string;
  } | null;
  if (!body?.name || !body?.subject || !body?.content) {
    return Response.json({ error: "name, subject e content são obrigatórios." }, { status: 400 });
  }

  const result = await updateEmailTemplateForApiKey(auth.apiKey, id, {
    name: body.name,
    subject: body.subject,
    content: body.content,
  });
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ emailTemplate: result.data });
}

// DELETE /api/v1/admin/email-templates/:id — requer chave admin
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const result = await deleteEmailTemplateForApiKey(auth.apiKey, id);
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json(result.data);
}
