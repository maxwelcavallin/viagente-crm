import { authenticateApiRequest } from "@/lib/api-keys";
import { getContact, updateContactForApiKey } from "@/lib/api-v1";

export const dynamic = "force-dynamic";

// GET /api/v1/contacts/:id
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const contact = await getContact(auth.apiKey.actingUser, id);
  if (!contact) return Response.json({ error: "Contato não encontrado." }, { status: 404 });

  return Response.json({ contact });
}

// PATCH /api/v1/contacts/:id  { name?, phone?, email?, customFields? }
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as {
    name?: string;
    phone?: string | null;
    email?: string | null;
    customFields?: Record<string, unknown>;
  } | null;
  if (!body) return Response.json({ error: "Corpo inválido." }, { status: 400 });

  const result = await updateContactForApiKey(auth.apiKey, id, body);
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });

  return Response.json({ contact: result.data });
}
