import Link from "next/link";
import { db } from "@/db";
import { leaddeltaConnections, leaddeltaSettings } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkedinIcon } from "@/components/icons/linkedin-icon";
import { cn } from "@/lib/utils";
import {
  funnelComparison,
  funnelExits,
  funnelKpis,
  funnelSdrOverview,
  funnelUnified,
  type StoredConnection,
} from "@/lib/leaddelta-analytics";
import { MoreIndicators } from "./more-indicators";

export const dynamic = "force-dynamic";

type ProfileFilter = "Perfil 1" | "Perfil 2" | null;

const PROFILE_TABS: { value: ProfileFilter; label: string }[] = [
  { value: null, label: "Todos" },
  { value: "Perfil 1", label: "Perfil 1" },
  { value: "Perfil 2", label: "Perfil 2" },
];

function profileHref(value: ProfileFilter): string {
  return value ? `/linkedin?profile=${encodeURIComponent(value)}` : "/linkedin";
}

function Bar({ label, count, max, sublabel }: { label: string; count: number; max: number; sublabel?: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className="text-muted-foreground">
          {count}
          {sublabel ? ` · ${sublabel}` : ""}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${count > 0 ? Math.max((count / max) * 100, 4) : 0}%` }}
        />
      </div>
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold">{value}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export default async function LinkedinPage({
  searchParams,
}: {
  searchParams: Promise<{ profile?: string }>;
}) {
  const { profile: rawProfile } = await searchParams;
  const profile: ProfileFilter = rawProfile === "Perfil 1" || rawProfile === "Perfil 2" ? rawProfile : null;

  const [settings] = await db.select().from(leaddeltaSettings).limit(1);
  const rows: StoredConnection[] = settings
    ? await db.select().from(leaddeltaConnections)
    : [];

  if (!settings || rows.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">LinkedIn</h1>
        <Card>
          <CardContent>
            <EmptyState
              icon={LinkedinIcon}
              title="Nenhuma sincronização ainda"
              description="Sincronize pela primeira vez pra ver os indicadores de conexões e funil de prospecção."
              action={
                <Button render={<Link href="/configuracoes/linkedin" />}>Ir para configuração</Button>
              }
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  const overview = funnelSdrOverview(rows, profile);
  const unified = funnelUnified(rows, profile);
  const kpis = funnelKpis(rows, profile);
  const exits = funnelExits(rows, profile);
  const comparison = funnelComparison(rows);

  const overviewMax = Math.max(...overview.stages.map((s) => s.count), 1);
  const unifiedMax = Math.max(...unified.map((s) => s.count), 1);
  const exitsMax = Math.max(...exits.map((s) => s.count), 1);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">LinkedIn</h1>
        <nav className="flex gap-1 rounded-lg border border-border p-1">
          {PROFILE_TABS.map((tab) => (
            <Link
              key={tab.label}
              href={profileHref(tab.value)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                tab.value === profile
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Total de leads" value={kpis.totalLeads} />
        <StatCard label="Ativos" value={kpis.ativos} />
        <StatCard label="Fechados" value={kpis.fechados} />
        <StatCard label="Taxa de conversão" value={`${kpis.taxaConversao}%`} />
        <StatCard label="Saídas negativas" value={kpis.saidasNegativas} />
        <StatCard label="Fora do funil" value={kpis.foraFunil} hint="sem tag de prospecção reconhecida" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Funil de prospecção — resumo</CardTitle>
          <p className="text-sm text-muted-foreground">
            Estágios cumulativos: Entrada → Contato realizado → Reunião → Fechado.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {overview.stages.map((stage) => (
            <Bar
              key={stage.stage}
              label={stage.stage}
              count={stage.count}
              max={overviewMax}
              sublabel={
                stage.pctTopo != null
                  ? `${stage.pctTopo}% do topo${
                      stage.pctPrev != null && stage.pctPrev !== stage.pctTopo
                        ? ` · ${stage.pctPrev}% da etapa anterior`
                        : ""
                    }`
                  : undefined
              }
            />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Funil completo por etapa</CardTitle>
          <p className="text-sm text-muted-foreground">
            Prospecção 1 a 5 → Em contato → Reunião → Em negociação → Fechado, com conversão etapa a etapa.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {unified.map((stage) => (
            <Bar
              key={stage.stage}
              label={stage.stage}
              count={stage.count}
              max={unifiedMax}
              sublabel={
                stage.conversionRate != null ? `${stage.conversionRate}% de conversão` : undefined
              }
            />
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Saídas negativas por motivo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {exits.every((e) => e.count === 0) ? (
              <p className="text-sm text-muted-foreground">Nenhuma saída negativa registrada.</p>
            ) : (
              exits.map((exit) => (
                <Bar key={exit.stage} label={exit.stage} count={exit.count} max={exitsMax} />
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Perfil 1 vs Perfil 2</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {comparison.map((c) => (
              <div key={c.profile} className="space-y-1 rounded-lg border border-border p-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{c.profile}</span>
                  <span className="text-sm text-muted-foreground">{c.total} leads</span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <span>Ativos no funil: {c.activeFunnel}</span>
                  <span>Fechados: {c.closed}</span>
                  <span>Conversão: {c.conversionRate}%</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <MoreIndicators rows={rows} />
    </div>
  );
}
