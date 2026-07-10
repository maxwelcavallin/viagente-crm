import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.mustChangePassword) redirect("/trocar-senha");

  const { period: rawPeriod } = await searchParams;
  const period: DashboardPeriod =
    rawPeriod === "30d" || rawPeriod === "tudo" ? rawPeriod : "mes";

  const summary = await getDashboardSummary(resolveDashboardRange(period));

  const conversionRate =
    summary.leadsCount > 0
      ? Math.round((summary.meetingsHeldCount / summary.leadsCount) * 100)
      : null;

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
                href={`/?period=${p}`}
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
