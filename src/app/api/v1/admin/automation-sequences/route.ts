import { authenticateApiRequest } from "@/lib/api-keys";
import { createAutomationSequenceForApiKey, listAutomationSequencesForApiKey } from "@/lib/api-v1-admin";

export const dynamic = "force-dynamic";

// GET /api/v1/admin/automation-sequences — requer chave admin
export async function GET(request: Request) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const result = await listAutomationSequencesForApiKey(auth.apiKey);
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ automationSequences: result.data });
}

// POST /api/v1/admin/automation-sequences — requer chave admin
// { name, active?, triggerType, triggerStageId?, triggerTagId?, noResponseDays?, conditions?, steps: [...] }
export async function POST(request: Request) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => null);
  if (!body?.name || !body?.triggerType || !Array.isArray(body?.steps)) {
    return Response.json({ error: "name, triggerType e steps são obrigatórios." }, { status: 400 });
  }

  const result = await createAutomationSequenceForApiKey(auth.apiKey, body);
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ automationSequence: result.data }, { status: 201 });
}
