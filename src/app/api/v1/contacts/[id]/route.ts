import { authenticateApiRequest } from "@/lib/api-keys";
import { getContact } from "@/lib/api-v1";

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
