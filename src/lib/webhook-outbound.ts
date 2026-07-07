import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { contacts, deals, webhookConfigs, webhookLogs } from "@/db/schema";

export type OutboundEvent =
  | "negocio_criado"
  | "etapa_alterada"
  | "negocio_ganho"
  | "negocio_perdido";

async function findMatchingConfigs(
  event: OutboundEvent,
  pipelineId: string,
  stageId: string
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
    return true;
  });
}

async function sendOne(
  config: typeof webhookConfigs.$inferSelect,
  body: unknown
): Promise<void> {
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
export async function dispatchOutboundWebhooks(
  event: OutboundEvent,
  dealId: string
): Promise<void> {
  try {
    const [deal] = await db.select().from(deals).where(eq(deals.id, dealId)).limit(1);
    if (!deal) return;

    const configs = await findMatchingConfigs(event, deal.pipelineId, deal.stageId);
    if (configs.length === 0) return;

    const [contact] = await db
      .select()
      .from(contacts)
      .where(eq(contacts.id, deal.contactId))
      .limit(1);

    const body = {
      event,
      deal: {
        id: deal.id,
        title: deal.title,
        value: deal.value,
        status: deal.status,
        temperature: deal.temperature,
        pipelineId: deal.pipelineId,
        stageId: deal.stageId,
        customFields: deal.customFields,
      },
      contact: contact
        ? {
            id: contact.id,
            name: contact.name,
            phone: contact.phone,
            email: contact.email,
          }
        : null,
    };

    await Promise.all(configs.map((config) => sendOne(config, body)));
  } catch (error) {
    console.error("[webhook-outbound] falha inesperada ao processar evento", error);
  }
}
