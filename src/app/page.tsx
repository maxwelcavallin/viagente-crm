import Link from "next/link";
import { redirect } from "next/navigation";
import { asc } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { pipelines, tags } from "@/db/schema";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DashboardFilters } from "@/components/dashboard-filters";
import { DailyBarChart } from "@/components/daily-bar-chart";
import { formatCurrencyBRL } from "@/lib/deal-format";
import {
  getDashboardSummary,
  resolveDashboardRange,
  type DashboardPeriod,
} from "@/lib/dashboard";
import { cn } from "@/lib/utils";

const PERIOD_LABELS: Record<DashboardPeriod, string> = {
  mes: "Mês atual",
  "30d": "Últimos 30 dias",
  tudo: "Tudo",
};

export const dynamic = "force-dynamic";

function formatDays(days: number | null): string {
  if (days == null) return "—";
  if (days < 1) return "menos de 1 dia";
  return `${Math.round(days)} dia${Math.round(days) === 1 ? "" : "s"}`;
}

function formatMinutes(minutes: number | null): string {
  if (minutes == null) return "—";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = minutes / 60;
  if (hours < 24) return `${hours.toFixed(1)} h`;
  return `${(hours / 24).toFixed(1)} dias`;
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; pipelineId?: string; tagId?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.mustChangePassword) redirect("/trocar-senha");

  const { period: rawPeriod, pipelineId: rawPipelineId, tagId: rawTagId } = await searchParams;
  const period: DashboardPeriod =
    rawPeriod === "30d" || rawPeriod === "tudo" ? rawPeriod : "mes";
  const pipelineId = rawPipelineId || null;
  const tagId = rawTagId || null;

  const [summary, allPipelines, allTags] = await Promise.all([
    getDashboardSummary(resolveDashboardRange(period), { pipelineId, tagId }),
    db.select({ id: pipelines.id, name: pipelines.name }).from(pipelines).orderBy(asc(pipelines.order)),
    db.select({ id: tags.id, name: tags.name }).from(tags).orderBy(asc(tags.name)),
  ]);

  const conversionRate =
    summary.leadsCount > 0
      ? Math.round((summary.meetingsHeldCount / summary.leadsCount) * 100)
      : null;

  const maxFunnelCount = Math.max(...summary.stageFunnel.map((s) => s.dealCount), 1);

  return (
    <AppShell>
      <div className="space-y-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Bem-vindo, {session.user.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Resumo do CRM Viagente.
            </p>
          </div>
          <nav className="flex gap-1 rounded-lg border border-border p-1">
            {(Object.keys(PERIOD_LABELS) as DashboardPeriod[]).map((p) => (
              <Link
                key={p}
                href={`/?period=${p}${pipelineId ? `&pipelineId=${pipelineId}` : ""}${tagId ? `&tagId=${tagId}` : ""}`}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  p === period
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {PERIOD_LABELS[p]}
              </Link>
            ))}
          </nav>
        </div>

        <DashboardFilters
          pipelines={allPipelines}
          tags={allTags}
          pipelineId={pipelineId}
          tagId={tagId}
        />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Leads (negócios criados)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{summary.leadsCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Reuniões realizadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{summary.meetingsHeldCount}</p>
              <p className="text-xs text-muted-foreground">
                {conversionRate != null
                  ? `${conversionRate}% de conversão sobre os leads`
                  : "Sem leads no período"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Ganho x Perdido
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">
                {summary.wonCount}{" "}
                <span className="text-base font-normal text-muted-foreground">x</span>{" "}
                {summary.lostCount}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Valor total vendido
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">
                {formatCurrencyBRL(summary.wonValueSum.toFixed(2)) ?? "R$ 0,00"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Atividades realizadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{summary.activitiesCompleted}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Mensagens enviadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{summary.messagesSent}</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Ciclo médio de venda
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{formatDays(summary.avgCycleDays)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Ticket médio
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">
                {summary.avgTicket != null
                  ? (formatCurrencyBRL(summary.avgTicket.toFixed(2)) ?? "—")
                  : "—"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Tempo médio até 1ª resposta
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">
                {formatMinutes(summary.avgFirstResponseMinutes)}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Funil por etapa</CardTitle>
            <p className="text-sm text-muted-foreground">
              Negócios em aberto agora — não é filtrado por período.{" "}
              {summary.funnelPipelineName && (
                <>
                  Pipeline: <strong>{summary.funnelPipelineName}</strong>
                  {summary.funnelIsDefaultPipeline && " (padrão — use o filtro acima pra escolher outra)"}
                </>
              )}
            </p>
          </CardHeader>
          <CardContent>
            {summary.stageFunnel.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma etapa cadastrada nessa pipeline.
              </p>
            ) : (
              <div className="space-y-2">
                {summary.stageFunnel.map((stage) => (
                  <div key={stage.stageId} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>{stage.stageName}</span>
                      <span className="text-muted-foreground">
                        {stage.dealCount} · {formatCurrencyBRL(stage.dealValue.toFixed(2)) ?? "R$ 0,00"}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{
                          width: `${stage.dealCount > 0 ? Math.max((stage.dealCount / maxFunnelCount) * 100, 4) : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ranking por vendedor</CardTitle>
          </CardHeader>
          <CardContent>
            {summary.ownerRanking.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum negócio ganho ou perdido com dono no período.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendedor</TableHead>
                    <TableHead>Ganhos</TableHead>
                    <TableHead>Valor vendido</TableHead>
                    <TableHead>Perdidos</TableHead>
                    <TableHead>Conversão</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.ownerRanking.map((row) => (
                    <TableRow key={row.userId}>
                      <TableCell>{row.userName}</TableCell>
                      <TableCell>{row.wonCount}</TableCell>
                      <TableCell>{formatCurrencyBRL(row.wonValue.toFixed(2)) ?? "R$ 0,00"}</TableCell>
                      <TableCell>{row.lostCount}</TableCell>
                      <TableCell>
                        {row.conversionRate != null ? `${Math.round(row.conversionRate * 100)}%` : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Mensagens por dia</CardTitle>
            <p className="text-sm text-muted-foreground">Últimos 90 dias, entrada e saída.</p>
          </CardHeader>
          <CardContent>
            <DailyBarChart data={summary.messagesByDay} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Motivos de perda</CardTitle>
          </CardHeader>
          <CardContent>
            {summary.lossReasonBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum negócio perdido com motivo registrado no período.
              </p>
            ) : (
              <div className="space-y-2">
                {summary.lossReasonBreakdown.map((reason) => (
                  <div
                    key={reason.label}
                    className="flex items-center justify-between text-sm"
                  >
                    <span>{reason.label}</span>
                    <span className="font-medium">{reason.count}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
