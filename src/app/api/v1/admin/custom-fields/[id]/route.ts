import { authenticateApiRequest } from "@/lib/api-keys";
import { deleteCustomFieldForApiKey, updateCustomFieldForApiKey } from "@/lib/api-v1-admin";

export const dynamic = "force-dynamic";

// PATCH /api/v1/admin/custom-fields/:id  { label, options? } — requer chave admin
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as {
    label?: string;
    options?: { value: string; label: string }[] | null;
  } | null;
  if (!body?.label) return Response.json({ error: "label é obrigatório." }, { status: 400 });

  const result = await updateCustomFieldForApiKey(auth.apiKey, id, { label: body.label, options: body.options });
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ customField: result.data });
}

// DELETE /api/v1/admin/custom-fields/:id — requer chave admin
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const result = await deleteCustomFieldForApiKey(auth.apiKey, id);
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json(result.data);
}
