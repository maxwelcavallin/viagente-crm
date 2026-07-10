import { and, count, countDistinct, eq, gte, sql, sum } from "drizzle-orm";
import { PgColumn } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { deals, lossReasons, messages, tasks } from "@/db/schema";

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

// "from: null" (período "tudo") não filtra por data — sql`true` mantém a
// condição sempre presente pra compor com `and()` sem precisar tratar
// undefined em cada chamada.
function dateGte(column: PgColumn, from: Date | null) {
  return from ? gte(column, from) : sql`true`;
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
};

// Todos os números aqui vêm de timestamps de evento real (won_at/lost_at/
// completed_at/created_at) — não de updated_at, que qualquer edição toca e
// não serviria pra filtrar "vendas deste mês" com precisão (ver contexto em
// deals.wonAt/lostAt no schema).
export async function getDashboardSummary(
  range: DashboardRange
): Promise<DashboardSummary> {
  const [
    [leadsRow],
    [meetingsRow],
    [wonRow],
    [lostRow],
    [activitiesRow],
    [messagesRow],
    lossReasonRows,
  ] = await Promise.all([
    db
      .select({ n: count(deals.id) })
      .from(deals)
      .where(dateGte(deals.createdAt, range.from)),
    db
      .select({ n: countDistinct(tasks.dealId) })
      .from(tasks)
      .where(
        and(
          eq(tasks.type, "agendamento"),
          eq(tasks.status, "concluida"),
          dateGte(tasks.completedAt, range.from)
        )
      ),
    db
      .select({ n: count(deals.id), total: sum(deals.value) })
      .from(deals)
      .where(and(eq(deals.status, "ganho"), dateGte(deals.wonAt, range.from))),
    db
      .select({ n: count(deals.id) })
      .from(deals)
      .where(and(eq(deals.status, "perdido"), dateGte(deals.lostAt, range.from))),
    db
      .select({ n: count(tasks.id) })
      .from(tasks)
      .where(and(eq(tasks.status, "concluida"), dateGte(tasks.completedAt, range.from))),
    db
      .select({ n: count(messages.id) })
      .from(messages)
      .where(and(eq(messages.direction, "saida"), dateGte(messages.createdAt, range.from))),
    db
      .select({ label: lossReasons.label, n: count(deals.id) })
      .from(deals)
      .innerJoin(lossReasons, eq(deals.lossReasonId, lossReasons.id))
      .where(and(eq(deals.status, "perdido"), dateGte(deals.lostAt, range.from)))
      .groupBy(lossReasons.id, lossReasons.label),
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
  };
}
