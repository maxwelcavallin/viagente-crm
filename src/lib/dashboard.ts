import {
  and,
  asc,
  avg,
  count,
  countDistinct,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  or,
  sql,
  sum,
} from "drizzle-orm";
import { PgColumn } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { deals, dealTags, lossReasons, messages, pipelines, stages, tasks, users } from "@/db/schema";

export type DashboardPeriod = "mes" | "30d" | "tudo";

export type DashboardRange = { from: Date | null };

export function resolveDashboardRange(period: DashboardPeriod): DashboardRange {
  const now = new Date();
  if (period === "mes") {
    return { from: new Date(now.getFullYear(), now.getMonth(), 1) };
  }
  if (period === "30d") {
    return { from: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) };
  }
  return { from: null };
}

export type DashboardFilters = {
  pipelineId: string | null;
  tagId: string | null;
};

// "from: null" (período "tudo") não filtra por data — sql`true` mantém a
// condição sempre presente pra compor com `and()` sem precisar tratar
// undefined em cada chamada.
function dateGte(column: PgColumn, from: Date | null) {
  return from ? gte(column, from) : sql`true`;
}

// Mesmo truque pra pipeline/tag: sem filtro ativo, sql`true` (bypass). Com
// filtro, restringe via subquery de deals.id — funciona tanto pra queries
// direto em `deals` quanto pra `tasks`/`messages` (que alcançam o negócio
// via deal_id nullable: NULL IN (...) é falso, exclui corretamente linhas
// sem negócio vinculado quando o filtro está ativo).
function dealScopeFilter(
  dealIdColumn: PgColumn,
  pipelineId: string | null,
  tagId: string | null
) {
  if (!pipelineId && !tagId) return sql`true`;
  const subquery = db
    .select({ id: deals.id })
    .from(deals)
    .where(
      and(
        pipelineId ? eq(deals.pipelineId, pipelineId) : sql`true`,
        tagId
          ? inArray(
              deals.id,
              db.select({ id: dealTags.dealId }).from(dealTags).where(eq(dealTags.tagId, tagId))
            )
          : sql`true`
      )
    );
  return inArray(dealIdColumn, subquery);
}

export type StageFunnelEntry = {
  stageId: string;
  stageName: string;
  dealCount: number;
  dealValue: number;
};

async function buildStageFunnel(
  pipelineId: string,
  tagId: string | null
): Promise<StageFunnelEntry[]> {
  const stageRows = await db
    .select({ id: stages.id, name: stages.name })
    .from(stages)
    .where(eq(stages.pipelineId, pipelineId))
    .orderBy(asc(stages.order));
  if (stageRows.length === 0) return [];

  const dealRows = await db
    .select({ stageId: deals.stageId, n: count(deals.id), total: sum(deals.value) })
    .from(deals)
    .where(
      and(
        eq(deals.pipelineId, pipelineId),
        eq(deals.status, "aberto"),
        dealScopeFilter(deals.id, null, tagId)
      )
    )
    .groupBy(deals.stageId);
  const byStage = new Map(dealRows.map((r) => [r.stageId, r]));

  return stageRows.map((s) => ({
    stageId: s.id,
    stageName: s.name,
    dealCount: byStage.get(s.id)?.n ?? 0,
    dealValue: byStage.get(s.id)?.total ? Number(byStage.get(s.id)!.total) : 0,
  }));
}

export type OwnerRankingEntry = {
  userId: string;
  userName: string;
  wonCount: number;
  wonValue: number;
  lostCount: number;
  conversionRate: number | null;
};

async function buildOwnerRanking(
  range: DashboardRange,
  filters: DashboardFilters
): Promise<OwnerRankingEntry[]> {
  const wonValueExpr = sql<string>`coalesce(sum(${deals.value}) filter (where ${deals.status} = 'ganho'), 0)`;
  const rows = await db
    .select({
      userId: deals.ownerId,
      userName: users.name,
      wonCount: sql<number>`count(*) filter (where ${deals.status} = 'ganho')`,
      wonValue: wonValueExpr,
      lostCount: sql<number>`count(*) filter (where ${deals.status} = 'perdido')`,
    })
    .from(deals)
    .innerJoin(users, eq(users.id, deals.ownerId))
    .where(
      and(
        isNotNull(deals.ownerId),
        dealScopeFilter(deals.id, filters.pipelineId, filters.tagId),
        or(
          and(eq(deals.status, "ganho"), dateGte(deals.wonAt, range.from)),
          and(eq(deals.status, "perdido"), dateGte(deals.lostAt, range.from))
        )
      )
    )
    .groupBy(deals.ownerId, users.name)
    .orderBy(desc(wonValueExpr))
    .limit(10);

  return rows
    .filter((r): r is typeof r & { userId: string } => r.userId != null)
    .map((r) => {
      const closed = r.wonCount + r.lostCount;
      return {
        userId: r.userId,
        userName: r.userName,
        wonCount: r.wonCount,
        wonValue: Number(r.wonValue),
        lostCount: r.lostCount,
        conversionRate: closed > 0 ? r.wonCount / closed : null,
      };
    });
}

export type MessagesByDayEntry = { date: string; count: number };

async function buildMessagesByDay(
  pipelineId: string | null,
  tagId: string | null
): Promise<MessagesByDayEntry[]> {
  const from = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const dayExpr = sql<string>`to_char(date_trunc('day', ${messages.createdAt}), 'YYYY-MM-DD')`;
  const rows = await db
    .select({ day: dayExpr, n: count(messages.id) })
    .from(messages)
    .where(and(gte(messages.createdAt, from), dealScopeFilter(messages.dealId, pipelineId, tagId)))
    .groupBy(dayExpr)
    .orderBy(asc(dayExpr));
  return rows.map((r) => ({ date: r.day, count: r.n }));
}

// Não filtra por pipeline/tag — é métrica de conversa (por contato), não de
// negócio. Usa SQL cru (mesmo mecanismo de /api/health) porque a lógica de
// "primeira entrada, primeira saída depois dela" fica bem mais direta com
// duas CTEs do que tentando expressar via query builder.
async function buildAvgFirstResponseMinutes(from: Date | null): Promise<number | null> {
  const result = await db.execute(sql`
    WITH first_inbound AS (
      SELECT DISTINCT ON (contact_id) contact_id, created_at AS inbound_at
      FROM messages
      WHERE direction = 'entrada' ${from ? sql`AND created_at >= ${from}` : sql``}
      ORDER BY contact_id, created_at ASC
    ),
    first_reply AS (
      SELECT fi.contact_id, MIN(m.created_at) AS reply_at
      FROM first_inbound fi
      JOIN messages m
        ON m.contact_id = fi.contact_id
        AND m.direction = 'saida'
        AND m.created_at > fi.inbound_at
      GROUP BY fi.contact_id
    )
    SELECT AVG(EXTRACT(EPOCH FROM (fr.reply_at - fi.inbound_at)) / 60)::float AS avg_minutes
    FROM first_inbound fi
    JOIN first_reply fr ON fr.contact_id = fi.contact_id
  `);
  const rows = (result as unknown as { rows?: Record<string, unknown>[] }).rows ?? (result as unknown as Record<string, unknown>[]);
  const avgMinutes = rows?.[0]?.avg_minutes;
  return typeof avgMinutes === "number" ? avgMinutes : avgMinutes ? Number(avgMinutes) : null;
}

export type DashboardSummary = {
  leadsCount: number;
  meetingsHeldCount: number;
  wonCount: number;
  wonValueSum: number;
  lostCount: number;
  activitiesCompleted: number;
  messagesSent: number;
  lossReasonBreakdown: { label: string; count: number }[];
  avgCycleDays: number | null;
  avgTicket: number | null;
  avgFirstResponseMinutes: number | null;
  stageFunnel: StageFunnelEntry[];
  funnelPipelineId: string | null;
  funnelPipelineName: string | null;
  funnelIsDefaultPipeline: boolean;
  ownerRanking: OwnerRankingEntry[];
  messagesByDay: MessagesByDayEntry[];
};

// Todos os números aqui vêm de timestamps de evento real (won_at/lost_at/
// completed_at/created_at) — não de updated_at, que qualquer edição toca e
// não serviria pra filtrar "vendas deste mês" com precisão (ver contexto em
// deals.wonAt/lostAt no schema).
export async function getDashboardSummary(
  range: DashboardRange,
  filters: DashboardFilters = { pipelineId: null, tagId: null }
): Promise<DashboardSummary> {
  const { pipelineId, tagId } = filters;

  let funnelPipelineId = pipelineId;
  let funnelPipelineName: string | null = null;
  let funnelIsDefaultPipeline = false;
  if (funnelPipelineId) {
    const [p] = await db
      .select({ name: pipelines.name })
      .from(pipelines)
      .where(eq(pipelines.id, funnelPipelineId))
      .limit(1);
    funnelPipelineName = p?.name ?? null;
  } else {
    const [first] = await db
      .select({ id: pipelines.id, name: pipelines.name })
      .from(pipelines)
      .orderBy(asc(pipelines.order))
      .limit(1);
    funnelPipelineId = first?.id ?? null;
    funnelPipelineName = first?.name ?? null;
    funnelIsDefaultPipeline = true;
  }

  const [
    [leadsRow],
    [meetingsRow],
    [wonRow],
    [lostRow],
    [activitiesRow],
    [messagesRow],
    lossReasonRows,
    [cycleTicketRow],
    avgFirstResponseMinutes,
    stageFunnel,
    ownerRanking,
    messagesByDay,
  ] = await Promise.all([
    db
      .select({ n: count(deals.id) })
      .from(deals)
      .where(and(dateGte(deals.createdAt, range.from), dealScopeFilter(deals.id, pipelineId, tagId))),
    db
      .select({ n: countDistinct(tasks.dealId) })
      .from(tasks)
      .where(
        and(
          eq(tasks.type, "agendamento"),
          eq(tasks.status, "concluida"),
          dateGte(tasks.completedAt, range.from),
          dealScopeFilter(tasks.dealId, pipelineId, tagId)
        )
      ),
    db
      .select({ n: count(deals.id), total: sum(deals.value) })
      .from(deals)
      .where(
        and(
          eq(deals.status, "ganho"),
          dateGte(deals.wonAt, range.from),
          dealScopeFilter(deals.id, pipelineId, tagId)
        )
      ),
    db
      .select({ n: count(deals.id) })
      .from(deals)
      .where(
        and(
          eq(deals.status, "perdido"),
          dateGte(deals.lostAt, range.from),
          dealScopeFilter(deals.id, pipelineId, tagId)
        )
      ),
    db
      .select({ n: count(tasks.id) })
      .from(tasks)
      .where(
        and(
          eq(tasks.status, "concluida"),
          dateGte(tasks.completedAt, range.from),
          dealScopeFilter(tasks.dealId, pipelineId, tagId)
        )
      ),
    db
      .select({ n: count(messages.id) })
      .from(messages)
      .where(
        and(
          eq(messages.direction, "saida"),
          dateGte(messages.createdAt, range.from),
          dealScopeFilter(messages.dealId, pipelineId, tagId)
        )
      ),
    db
      .select({ label: lossReasons.label, n: count(deals.id) })
      .from(deals)
      .innerJoin(lossReasons, eq(deals.lossReasonId, lossReasons.id))
      .where(
        and(
          eq(deals.status, "perdido"),
          dateGte(deals.lostAt, range.from),
          dealScopeFilter(deals.id, pipelineId, tagId)
        )
      )
      .groupBy(lossReasons.id, lossReasons.label),
    db
      .select({
        avgDays: sql<string | null>`avg(extract(epoch from (${deals.wonAt} - ${deals.createdAt})) / 86400)`,
        avgTicket: avg(deals.value),
      })
      .from(deals)
      .where(
        and(
          eq(deals.status, "ganho"),
          dateGte(deals.wonAt, range.from),
          dealScopeFilter(deals.id, pipelineId, tagId)
        )
      ),
    buildAvgFirstResponseMinutes(range.from),
    funnelPipelineId ? buildStageFunnel(funnelPipelineId, tagId) : Promise.resolve([]),
    buildOwnerRanking(range, filters),
    buildMessagesByDay(pipelineId, tagId),
  ]);

  return {
    leadsCount: leadsRow.n,
    meetingsHeldCount: meetingsRow.n,
    wonCount: wonRow.n,
    wonValueSum: wonRow.total ? Number(wonRow.total) : 0,
    lostCount: lostRow.n,
    activitiesCompleted: activitiesRow.n,
    messagesSent: messagesRow.n,
    lossReasonBreakdown: lossReasonRows
      .map((r) => ({ label: r.label, count: r.n }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
    avgCycleDays: cycleTicketRow.avgDays ? Number(cycleTicketRow.avgDays) : null,
    avgTicket: cycleTicketRow.avgTicket ? Number(cycleTicketRow.avgTicket) : null,
    avgFirstResponseMinutes,
    stageFunnel,
    funnelPipelineId,
    funnelPipelineName,
    funnelIsDefaultPipeline,
    ownerRanking,
    messagesByDay,
  };
}
