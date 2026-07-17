import { authenticateApiRequest } from "@/lib/api-keys";
import { createTagAutomationForApiKey, listTagAutomationsForApiKey } from "@/lib/api-v1-admin";

export const dynamic = "force-dynamic";

// GET /api/v1/admin/tag-automations — requer chave admin
export async function GET(request: Request) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const result = await listTagAutomationsForApiKey(auth.apiKey);
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ tagAutomations: result.data });
}

// POST /api/v1/admin/tag-automations — requer chave admin
// { tagId, title, type, trigger, delayMinutes?, messageTemplateId?, autoSend?, autoSendChannelId? }
// type aceita "email" (Etapa 28 libera esse valor via API mesmo a tela ainda não permitindo).
export async function POST(request: Request) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  const body = (await request.json().catch(() => null)) as {
    tagId?: string;
    title?: string;
    type?: "mensagem" | "ligacao" | "agendamento" | "generica" | "email";
    trigger?: "tag_adicionada" | "dias_apos_tag";
    delayMinutes?: number | null;
    messageTemplateId?: string | null;
    autoSend?: boolean;
    autoSendChannelId?: string | null;
  } | null;
  if (!body?.tagId || !body?.title || !body?.type || !body?.trigger) {
    return Response.json({ error: "tagId, title, type e trigger são obrigatórios." }, { status: 400 });
  }

  const result = await createTagAutomationForApiKey(auth.apiKey, {
    tagId: body.tagId,
    title: body.title,
    type: body.type,
    trigger: body.trigger,
    delayMinutes: body.delayMinutes,
    messageTemplateId: body.messageTemplateId,
    autoSend: body.autoSend,
    autoSendChannelId: body.autoSendChannelId,
  });
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ tagAutomation: result.data }, { status: 201 });
}
