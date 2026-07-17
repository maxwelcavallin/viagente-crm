import { authenticateApiRequest } from "@/lib/api-keys";
import { sendActivityEmailForApiKey } from "@/lib/api-v1";

export const dynamic = "force-dynamic";

// POST /api/v1/deals/:id/email  { "to": "...", "subject": "...", "body": "..." }
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as {
    to?: string;
    subject?: string;
    body?: string;
  } | null;
  if (!body?.to || !body?.subject || !body?.body) {
    return Response.json({ error: "to, subject e body são obrigatórios." }, { status: 400 });
  }

  const result = await sendActivityEmailForApiKey(auth.apiKey, {
    dealId: id,
    to: body.to,
    subject: body.subject,
    body: body.body,
  });
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });

  return Response.json(result.data, { status: 201 });
}
