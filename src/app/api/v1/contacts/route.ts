import { authenticateApiRequest } from "@/lib/api-keys";
import { listContacts } from "@/lib/api-v1";

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
