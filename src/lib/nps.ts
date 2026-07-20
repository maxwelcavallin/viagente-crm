import { randomBytes } from "node:crypto";
import { and, eq, isNotNull, isNull, lte, or } from "drizzle-orm";
import { db } from "@/db";
import {
  contacts,
  deals,
  messageTemplates,
  npsSettings,
  npsSurveys,
  tasks,
} from "@/db/schema";
import { formatCurrencyBRL } from "@/lib/deal-format";
import { sendTextMessage } from "@/lib/send-message";
import { firstNameOf, substituteTemplate } from "@/lib/templates";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// DETRATOR_MAX / PROMOTOR_MIN: escala padrão de NPS (0-6 detrator, 7-8
// neutro, 9-10 promotor) — não é configurável nesta etapa.
const DETRATOR_MAX = 6;
const PROMOTOR_MIN = 9;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} não está definida`);
  return value;
}

export function buildNpsLink(token: string): string {
  return `${requireEnv("APP_BASE_URL")}/nps/${token}`;
}

async function getSingletonSettings() {
  const [settings] = await db.select().from(npsSettings).limit(1);
  return settings ?? null;
}

// Varredura horária (mesmo cron da Etapa 13/22, ver /api/cron/task-automation):
// não existe motor de automação pronto pro gatilho "negócio ganho", então
// esta função reavalia o estado atual dos negócios a cada execução —
// mesmo raciocínio das stage_tasks com triggerDelayMinutes (Etapa 13),
// usando stageEnteredAt/wonAt em vez de guardar um "pendente" à parte.
export async function runNpsSweep(): Promise<{ sent: number }> {
  const settings = await getSingletonSettings();
  if (!settings || !settings.active || !settings.channelId || !settings.messageTemplateId) {
    return { sent: 0 };
  }

  const cutoff = new Date(Date.now() - settings.delayDays * MS_PER_DAY);

  const stageCondition = settings.triggerStageId
    ? and(eq(deals.stageId, settings.triggerStageId), lte(deals.stageEnteredAt, cutoff))
    : undefined;
  const wonCondition = settings.triggerOnWon
    ? and(eq(deals.status, "ganho"), lte(deals.wonAt, cutoff))
    : undefined;
  const triggerCondition = [stageCondition, wonCondition].filter((c) => c != null);
  if (triggerCondition.length === 0) return { sent: 0 };

  const eligible = await db
    .select({
      dealId: deals.id,
      dealValue: deals.value,
      contactId: contacts.id,
      contactName: contacts.name,
      contactEmail: contacts.email,
    })
    .from(deals)
    .innerJoin(contacts, eq(deals.contactId, contacts.id))
    .leftJoin(npsSurveys, eq(npsSurveys.dealId, deals.id))
    .where(and(or(...triggerCondition), isNull(npsSurveys.id)));

  const [template] = await db
    .select({ content: messageTemplates.content })
    .from(messageTemplates)
    .where(eq(messageTemplates.id, settings.messageTemplateId))
    .limit(1);
  if (!template) return { sent: 0 };

  let sent = 0;
  for (const deal of eligible) {
    const token = randomBytes(24).toString("hex");
    const text = substituteTemplate(template.content, {
      nome_contato: deal.contactName,
      primeiro_nome: firstNameOf(deal.contactName),
      email_contato: deal.contactEmail ?? "",
      valor: formatCurrencyBRL(deal.dealValue) ?? "",
      link_pesquisa: buildNpsLink(token),
    });

    const result = await sendTextMessage({
      channelId: settings.channelId,
      contactId: deal.contactId,
      message: text,
    });
    if (!result.ok) {
      console.error(`[nps] falha ao enviar pesquisa pro negócio ${deal.dealId}: ${result.error}`);
      continue;
    }

    // dealId é único em nps_surveys — se duas execuções concorrentes do
    // cron baterem no mesmo negócio (não deveria, mas é hourly, não
    // instantâneo), a segunda falha aqui em vez de duplicar o envio.
    await db.insert(npsSurveys).values({
      dealId: deal.dealId,
      contactId: deal.contactId,
      channel: "whatsapp",
      token,
    });
    sent += 1;
  }

  return { sent };
}

export type NpsResponseResult =
  | { ok: true }
  | { ok: false; error: "not_found" | "already_responded" | "invalid_score" };

export async function recordNpsResponse(
  token: string,
  score: number,
  feedback: string | null
): Promise<NpsResponseResult> {
  if (!Number.isInteger(score) || score < 0 || score > 10) {
    return { ok: false, error: "invalid_score" };
  }

  const [survey] = await db.select().from(npsSurveys).where(eq(npsSurveys.token, token)).limit(1);
  if (!survey) return { ok: false, error: "not_found" };
  if (survey.respondedAt) return { ok: false, error: "already_responded" };

  await db
    .update(npsSurveys)
    .set({ score, feedback, respondedAt: new Date() })
    .where(eq(npsSurveys.id, survey.id));

  if (score <= DETRATOR_MAX) {
    const [deal] = await db
      .select({ title: deals.title })
      .from(deals)
      .where(eq(deals.id, survey.dealId))
      .limit(1);
    await db.insert(tasks).values({
      dealId: survey.dealId,
      title: `Follow-up de insatisfação — nota ${score}${deal ? ` (${deal.title})` : ""}`,
      type: "generica",
      status: "pendente",
    });
  }

  return { ok: true };
}

export async function getNpsSurveyForToken(token: string) {
  const [survey] = await db.select().from(npsSurveys).where(eq(npsSurveys.token, token)).limit(1);
  return survey ?? null;
}

export type NpsSummary = {
  average: number | null;
  responseCount: number;
  promoters: number;
  passives: number;
  detractors: number;
  recentWithFeedback: {
    dealId: string;
    score: number;
    feedback: string;
    respondedAt: string;
  }[];
};

export async function getNpsSummary(): Promise<NpsSummary> {
  const responded = await db
    .select({
      dealId: npsSurveys.dealId,
      score: npsSurveys.score,
      feedback: npsSurveys.feedback,
      respondedAt: npsSurveys.respondedAt,
    })
    .from(npsSurveys)
    .where(isNotNull(npsSurveys.score));

  const scores = responded.map((r) => r.score!);
  const promoters = scores.filter((s) => s >= PROMOTOR_MIN).length;
  const detractors = scores.filter((s) => s <= DETRATOR_MAX).length;
  const passives = scores.length - promoters - detractors;

  const recentWithFeedback = responded
    .filter((r): r is typeof r & { feedback: string; respondedAt: Date } =>
      Boolean(r.feedback && r.respondedAt)
    )
    .sort((a, b) => b.respondedAt.getTime() - a.respondedAt.getTime())
    .slice(0, 5)
    .map((r) => ({
      dealId: r.dealId,
      score: r.score!,
      feedback: r.feedback,
      respondedAt: r.respondedAt.toISOString(),
    }));

  return {
    average: scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
    responseCount: scores.length,
    promoters,
    passives,
    detractors,
    recentWithFeedback,
  };
}

