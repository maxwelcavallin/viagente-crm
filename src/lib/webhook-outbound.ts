import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  contactTags,
  contacts,
  deals,
  stages,
  tags,
  users,
  webhookConfigs,
  webhookLogs,
} from "@/db/schema";

export type OutboundEvent =
  | "negocio_criado"
  | "etapa_alterada"
  | "negocio_ganho"
  | "negocio_perdido"
  | "tag_adicionada";

// Rótulo em PT-BR de deals.status — mesma palavra já usada na UI (kanban,
// filtros). Quem consome o webhook (ex: Make) decide como traduzir/mapear
// pro vocabulário do destino final (ex: Meta CAPI "LOST"/"WON").
const DEAL_STATUS_LABEL: Record<string, string> = {
  aberto: "Aberto",
  ganho: "Ganho",
  perdido: "Perdido",
};

async function findMatchingConfigs(
  event: OutboundEvent,
  pipelineId: string,
  stageId: string,
  tagId?: string
) {
  const rows = await db
    .select()
    .from(webhookConfigs)
    .where(
      and(eq(webhookConfigs.direction, "saida"), eq(webhookConfigs.active, true))
    );

  return rows.filter((cfg) => {
    const events = (cfg.events as string[] | null) ?? [];
    if (!events.includes(event)) return false;
    if (cfg.pipelineId && cfg.pipelineId !== pipelineId) return false;
    if (event === "etapa_alterada" && cfg.stageId && cfg.stageId !== stageId) {
      return false;
    }
    if (event === "tag_adicionada" && cfg.tagId && cfg.tagId !== tagId) {
      return false;
    }
    return true;
  });
}

// Resolve "deal.customFields.gasto_cartao" dentro do objeto de contexto —
// mesma notação de ponto usada em fieldMapping (entrada), aqui pro sentido
// contrário (montar o payload de saída em vez de ler um de entrada).
function getByPath(source: unknown, path: string): unknown {
  const parts = path.split(".").filter(Boolean);
  let current: unknown = source;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

// Substitui cada "{{caminho}}" pelo valor resolvido no contexto —
// placeholder sozinho numa posição de valor JSON (ex: `"valor": {{deal.value}}`)
// vira o JSON literal daquele valor (número, objeto, null…); embutido dentro
// de uma string já entre aspas (ex: `"nome": "Oi {{contact.name}}"`) vira o
// texto puro. Mesma convenção "{{}}" já usada nos templates de mensagem (ver
// src/lib/templates.ts) — só que aqui o resultado final precisa ser JSON
// válido, então placeholder ausente vira "null" em vez de string vazia.
function fillPayloadTemplate(template: string, context: Record<string, unknown>): string {
  // Passo 1: placeholder que É o valor inteiro entre aspas coladas, sem mais
  // nada dentro — ex: `"email": "{{contact.email}}"`. Aqui dá pra decidir
  // sozinho se o resultado final leva aspas (string) ou não (null/número/
  // objeto): sem esse passo, um campo nullable (contact.email sem valor)
  // escrito com aspas virava a STRING "null" em vez do null de verdade do
  // JSON — o contrário do que o template quis dizer.
  let result = template.replace(/"\{\{\s*([\w.]+)\s*\}\}"/g, (match, path: string) => {
    const value = getByPath(context, path);
    return value === undefined ? "null" : JSON.stringify(value);
  });
  // Passo 2: o que sobrou — sem aspas coladas dos dois lados, seja um valor
  // bruto sem aspas (ex: `{{deal.value}}`) ou embutido no meio de um texto
  // maior (ex: `"Oi {{contact.name}}"`) — sempre insere o conteúdo cru,
  // escapado pra não quebrar a string ao redor quando for string (aspas/
  // barra/quebra de linha do valor real).
  result = result.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, path: string) => {
    const value = getByPath(context, path);
    if (value === undefined) return "null";
    return typeof value === "string" ? JSON.stringify(value).slice(1, -1) : JSON.stringify(value);
  });
  return result;
}

// Null (sem template customizado) usa o formato padrão fixo; com template,
// substitui os placeholders e valida que o resultado é JSON de verdade —
// erro de sintaxe (parêntese/vírgula esquecido no template) vira log de erro
// em vez de mandar lixo pro destino (ver sendOne, mesmo tratamento de falha
// de rede/HTTP).
function buildOutboundBody(
  template: string | null,
  context: Record<string, unknown>
): { ok: true; body: unknown } | { ok: false; error: string } {
  if (!template) return { ok: true, body: context };
  const filled = fillPayloadTemplate(template, context);
  try {
    return { ok: true, body: JSON.parse(filled) };
  } catch {
    return { ok: false, error: "payloadTemplate não é um JSON válido depois de substituir os placeholders." };
  }
}

async function sendOne(
  config: typeof webhookConfigs.$inferSelect,
  context: Record<string, unknown>
): Promise<void> {
  const built = buildOutboundBody(config.payloadTemplate, context);
  if (!built.ok) {
    await db.insert(webhookLogs).values({
      webhookConfigId: config.id,
      direction: "saida",
      payload: context as object,
      status: "erro",
      errorMessage: built.error,
    });
    return;
  }
  const body = built.body;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    let res: Response;
    try {
      res = await fetch(config.targetUrl!, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
    await db.insert(webhookLogs).values({
      webhookConfigId: config.id,
      direction: "saida",
      payload: body as object,
      status: res.ok ? "sucesso" : "erro",
      errorMessage: res.ok ? null : `HTTP ${res.status}`,
    });
  } catch (error) {
    await db
      .insert(webhookLogs)
      .values({
        webhookConfigId: config.id,
        direction: "saida",
        payload: body as object,
        status: "erro",
        errorMessage:
          error instanceof Error
            ? error.message
            : "Erro desconhecido ao disparar webhook",
      })
      .catch(() => {});
  }
}

// Fire-and-forget: nunca lança, nunca deve bloquear a ação principal do CRM
// que a disparou (ver seção 6 da spec — falha de saída só vira log de erro).
// `tagId` só é relevante (e obrigatório pra escopo funcionar) no evento
// 'tag_adicionada' — chame uma vez por tag genuinamente adicionada, nunca
// com a lista inteira de uma vez (ver call sites: syncDealTags,
// bulkAddTagAction, attachTagsToDeal, addTagToDealForApiKey,
// createDealForApiKey, automation-sequences.ts).
export async function dispatchOutboundWebhooks(
  event: OutboundEvent,
  dealId: string,
  tagId?: string
): Promise<void> {
  try {
    const [deal] = await db.select().from(deals).where(eq(deals.id, dealId)).limit(1);
    if (!deal) return;

    const configs = await findMatchingConfigs(event, deal.pipelineId, deal.stageId, tagId);
    if (configs.length === 0) return;

    const [contact] = await db
      .select()
      .from(contacts)
      .where(eq(contacts.id, deal.contactId))
      .limit(1);

    const [stage] = await db
      .select({ name: stages.name })
      .from(stages)
      .where(eq(stages.id, deal.stageId))
      .limit(1);

    const owner = deal.ownerId
      ? (
          await db
            .select({ id: users.id, name: users.name, email: users.email })
            .from(users)
            .where(eq(users.id, deal.ownerId))
            .limit(1)
        )[0] ?? null
      : null;

    const contactTagRows = contact
      ? await db
          .select({ name: tags.name })
          .from(contactTags)
          .innerJoin(tags, eq(contactTags.tagId, tags.id))
          .where(eq(contactTags.contactId, contact.id))
      : [];

    let tag: { id: string; name: string } | null = null;
    if (event === "tag_adicionada" && tagId) {
      const [row] = await db.select({ id: tags.id, name: tags.name }).from(tags).where(eq(tags.id, tagId)).limit(1);
      tag = row ?? null;
    }

    // Também é o formato padrão fixo (quando o webhook não tem
    // payloadTemplate customizado, ver sendOne) e o conjunto de placeholders
    // disponíveis pra quem customiza (ex: {{deal.title}}, {{contact.phone}},
    // {{deal.stageName}}, {{deal.ownerEmail}}).
    const context = {
      event,
      deal: {
        id: deal.id,
        title: deal.title,
        value: deal.value,
        status: deal.status,
        statusLabel: DEAL_STATUS_LABEL[deal.status] ?? deal.status,
        temperature: deal.temperature,
        pipelineId: deal.pipelineId,
        stageId: deal.stageId,
        stageName: stage?.name ?? null,
        ownerId: deal.ownerId,
        ownerName: owner?.name ?? null,
        ownerEmail: owner?.email ?? null,
        customFields: deal.customFields,
      },
      contact: contact
        ? {
            id: contact.id,
            name: contact.name,
            phone: contact.phone,
            email: contact.email,
            tags: contactTagRows.map((r) => r.name),
          }
        : null,
      ...(tag ? { tag } : {}),
    };

    await Promise.all(configs.map((config) => sendOne(config, context)));
  } catch (error) {
    console.error("[webhook-outbound] falha inesperada ao processar evento", error);
  }
}
