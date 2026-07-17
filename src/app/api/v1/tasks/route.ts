import { authenticateApiRequest, hasWriteScope } from "@/lib/api-keys";
import { createTaskForApiKey, listTasks } from "@/lib/api-v1";

export const dynamic = "force-dynamic";

// GET /api/v1/tasks?dealId=&status=&limit=&offset=
export async function GET(request: Request) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const params = new URL(request.url).searchParams;
  const limitRaw = params.get("limit");
  const offsetRaw = params.get("offset");

  const tasks = await listTasks(auth.apiKey.actingUser, {
    dealId: params.get("dealId") ?? undefined,
    status: (params.get("status") as "pendente" | "concluida" | null) ?? undefined,
    limit: limitRaw ? Number(limitRaw) : undefined,
    offset: offsetRaw ? Number(offsetRaw) : undefined,
  });

  return Response.json({ tasks });
}

// POST /api/v1/tasks  { "dealId": "...", "title": "...", "type": "generica", "dueAt": "2026-08-01T00:00:00Z" | null }
export async function POST(request: Request) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  if (!hasWriteScope(auth.apiKey)) {
    return Response.json({ error: "Chave sem escopo de escrita." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    dealId?: string;
    title?: string;
    type?: "mensagem" | "ligacao" | "agendamento" | "generica";
    dueAt?: string | null;
  } | null;
  if (!body?.dealId || !body?.title) {
    return Response.json({ error: "dealId e title são obrigatórios." }, { status: 400 });
  }

  const result = await createTaskForApiKey(auth.apiKey, {
    dealId: body.dealId,
    title: body.title,
    type: body.type ?? "generica",
    dueAt: body.dueAt ?? null,
  });
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });

  return Response.json({ task: result.data }, { status: 201 });
}
