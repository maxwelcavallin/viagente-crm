import { authenticateApiRequest } from "@/lib/api-keys";
import { createContactForApiKey, listContacts } from "@/lib/api-v1";

export const dynamic = "force-dynamic";

// GET /api/v1/contacts?search=&ownerId=&limit=&offset=
export async function GET(request: Request) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const params = new URL(request.url).searchParams;
  const limitRaw = params.get("limit");
  const offsetRaw = params.get("offset");

  const contacts = await listContacts(auth.apiKey.actingUser, {
    search: params.get("search") ?? undefined,
    ownerId: params.get("ownerId") ?? undefined,
    limit: limitRaw ? Number(limitRaw) : undefined,
    offset: offsetRaw ? Number(offsetRaw) : undefined,
  });

  return Response.json({ contacts });
}

// POST /api/v1/contacts  { name, phone, email?, customFields? }
export async function POST(request: Request) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const body = (await request.json().catch(() => null)) as {
    name?: string;
    phone?: string;
    email?: string | null;
    customFields?: Record<string, unknown>;
  } | null;
  if (!body?.name || !body?.phone) {
    return Response.json({ error: "name e phone são obrigatórios." }, { status: 400 });
  }

  const result = await createContactForApiKey(auth.apiKey, {
    name: body.name,
    phone: body.phone,
    email: body.email,
    customFields: body.customFields,
  });
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });

  return Response.json({ contact: result.data }, { status: 201 });
}
