import { authenticateApiRequest } from "@/lib/api-keys";
import { deleteMessageTemplateForApiKey, updateMessageTemplateForApiKey } from "@/lib/api-v1-admin";

export const dynamic = "force-dynamic";

// PATCH /api/v1/admin/message-templates/:id  { name, items: [{ content }] } — requer
// chave admin. Substitui o conjunto de mensagens inteiro (apaga anexos já
// configurados nelas pela tela — ver comentário em updateMessageTemplateForApiKey).
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as {
    name?: string;
    items?: { content?: string }[];
  } | null;
  if (!body?.name || !body?.items?.length) {
    return Response.json({ error: "name e items são obrigatórios." }, { status: 400 });
  }

  const result = await updateMessageTemplateForApiKey(auth.apiKey, id, {
    name: body.name,
    items: body.items.map((it) => ({ content: it.content ?? "" })),
  });
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ messageTemplate: result.data });
}

// DELETE /api/v1/admin/message-templates/:id — requer chave admin
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const result = await deleteMessageTemplateForApiKey(auth.apiKey, id);
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json(result.data);
}
