"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import {
  connectionsOverTime,
  kpis,
  pipelineByWorkspace,
  tagsDistribution,
  topCompanies,
  topLocations,
  workspaceDistribution,
  type StoredConnection,
} from "@/lib/leaddelta-analytics";

const ALL = "__todos__";
const NO_TAG = "Sem tag";
const PAGE_SIZE = 25;

function matchesSearch(row: StoredConnection, term: string): boolean {
  if (!term) return true;
  const normalized = term.toLowerCase();
  const fullName = `${row.firstName} ${row.lastName}`.toLowerCase();
  return (
    fullName.includes(normalized) ||
    row.company.toLowerCase().includes(normalized) ||
    row.jobTitle.toLowerCase().includes(normalized) ||
    row.headline.toLowerCase().includes(normalized)
  );
}

export function MoreIndicators({ rows }: { rows: StoredConnection[] }) {
  const [expanded, setExpanded] = useState(false);

  const [search, setSearch] = useState("");
  const [tag, setTag] = useState<string>(ALL);
  const [company, setCompany] = useState("");
  const [workspace, setWorkspace] = useState<string>(ALL);
  const [hasEmail, setHasEmail] = useState(false);
  const [hasPhone, setHasPhone] = useState(false);
  const [page, setPage] = useState(0);

  const generalKpis = useMemo(() => kpis(rows), [rows]);
  const stageCounts = useMemo(() => tagsDistribution(rows), [rows]);
  const companies = useMemo(() => topCompanies(rows), [rows]);
  const locations = useMemo(() => topLocations(rows), [rows]);
  const timeline = useMemo(() => connectionsOverTime(rows), [rows]);
  const workspaces = useMemo(() => workspaceDistribution(rows), [rows]);
  const crosstab = useMemo(() => pipelineByWorkspace(rows), [rows]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const row of rows) {
      if (row.tags.length === 0) set.add(NO_TAG);
      else row.tags.forEach((t) => set.add(t));
    }
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (tag !== ALL) {
        if (tag === NO_TAG ? row.tags.length > 0 : !row.tags.includes(tag)) return false;
      }
      if (company && !row.company.toLowerCase().includes(company.toLowerCase())) return false;
      if (workspace !== ALL && (row.workspaceName || "Sem workspace") !== workspace) return false;
      if (hasEmail && !row.hasEmail) return false;
      if (hasPhone && !row.hasPhone) return false;
      if (!matchesSearch(row, search)) return false;
      return true;
    });
  }, [rows, tag, company, workspace, hasEmail, hasPhone, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const pageRows = filtered.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE);

  function resetPage() {
    setPage(0);
  }

  return (
    <div className="space-y-4">
      <Button type="button" variant="outline" onClick={() => setExpanded((v) => !v)}>
        {expanded ? (
          <>
            <ChevronUp size={16} strokeWidth={1.75} /> Ver menos
          </>
        ) : (
          <>
            <ChevronDown size={16} strokeWidth={1.75} /> Ver mais indicadores
          </>
        )}
      </Button>

      {expanded && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total de conexões
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{generalKpis.total}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">Com e-mail</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{generalKpis.withEmail}</p>
                <p className="text-xs text-muted-foreground">{generalKpis.emailPct}% do total</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">Sem tag</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{generalKpis.untagged}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">Empresas distintas</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{generalKpis.companies}</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Contagem por estágio</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {stageCounts.map((s) => (
                  <div key={s.tag} className="flex items-center justify-between text-sm">
                    <span>{s.tag}</span>
                    <span className="font-medium">{s.count}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top cidades/regiões</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {locations.map((l) => (
                  <div key={l.location} className="flex items-center justify-between text-sm">
                    <span>{l.location}</span>
                    <span className="font-medium">{l.count}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Novas conexões por mês</CardTitle>
                <p className="text-sm text-muted-foreground">Contagem mensal e curva acumulada.</p>
              </CardHeader>
              <CardContent className="space-y-2">
                {timeline.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem dados de data de conexão.</p>
                ) : (
                  timeline.map((point) => (
                    <div key={point.month} className="flex items-center justify-between text-sm">
                      <span>{point.month}</span>
                      <span className="text-muted-foreground">
                        {point.count} novas · {point.cumulative} acumulado
                      </span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Distribuição por workspace</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {workspaces.map((w) => (
                  <div key={w.workspace} className="flex items-center justify-between text-sm">
                    <span>{w.workspace}</span>
                    <span className="font-medium">{w.count}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Cruzamento workspace × tag</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Workspace</TableHead>
                      <TableHead>Tag</TableHead>
                      <TableHead>Contagem</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {crosstab.map((row) => (
                      <TableRow key={`${row.workspace}::${row.tag}`}>
                        <TableCell>{row.workspace}</TableCell>
                        <TableCell>{row.tag}</TableCell>
                        <TableCell>{row.count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Empresas mais frequentes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {companies.map((c) => (
                <div key={c.company} className="flex items-center justify-between text-sm">
                  <span>{c.company}</span>
                  <span className="font-medium">{c.count}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Conexões</CardTitle>
              <p className="text-sm text-muted-foreground">{filtered.length} de {rows.length} conexões.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-full max-w-xs">
                  <Search
                    size={16}
                    strokeWidth={1.75}
                    className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      resetPage();
                    }}
                    placeholder="Buscar por nome, cargo, empresa..."
                    className="h-9 pl-8"
                  />
                </div>
                <Input
                  value={company}
                  onChange={(e) => {
                    setCompany(e.target.value);
                    resetPage();
                  }}
                  placeholder="Filtrar por empresa"
                  className="h-9 w-48"
                />
                <Select
                  items={Object.fromEntries([[ALL, "Todas as tags"], ...allTags.map((t) => [t, t])])}
                  value={tag}
                  onValueChange={(v) => {
                    setTag(v ?? ALL);
                    resetPage();
                  }}
                >
                  <SelectTrigger className="w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Todas as tags</SelectItem>
                    {allTags.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  items={Object.fromEntries([
                    [ALL, "Todos os workspaces"],
                    ...workspaces.map((w) => [w.workspace, w.workspace]),
                  ])}
                  value={workspace}
                  onValueChange={(v) => {
                    setWorkspace(v ?? ALL);
                    resetPage();
                  }}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Todos os workspaces</SelectItem>
                    {workspaces.map((w) => (
                      <SelectItem key={w.workspace} value={w.workspace}>
                        {w.workspace}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={hasEmail}
                    onCheckedChange={(v) => {
                      setHasEmail(v);
                      resetPage();
                    }}
                  />
                  Tem e-mail
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={hasPhone}
                    onCheckedChange={(v) => {
                      setHasPhone(v);
                      resetPage();
                    }}
                  />
                  Tem telefone
                </label>
              </div>

              {filtered.length === 0 ? (
                <EmptyState
                  icon={Search}
                  title="Nenhuma conexão encontrada"
                  description="Ajuste os filtros pra ver outros resultados."
                />
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>Empresa</TableHead>
                          <TableHead>Cargo</TableHead>
                          <TableHead>Localização</TableHead>
                          <TableHead>Workspace</TableHead>
                          <TableHead>Tags</TableHead>
                          <TableHead>E-mail</TableHead>
                          <TableHead>Telefone</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pageRows.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell>
                              {row.linkedinUrl ? (
                                <a
                                  href={row.linkedinUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-medium text-primary hover:underline"
                                >
                                  {row.firstName} {row.lastName}
                                </a>
                              ) : (
                                <span className="font-medium">
                                  {row.firstName} {row.lastName}
                                </span>
                              )}
                            </TableCell>
                            <TableCell>{row.company || "—"}</TableCell>
                            <TableCell>{row.jobTitle || "—"}</TableCell>
                            <TableCell>{row.locationNormalized || "—"}</TableCell>
                            <TableCell>{row.workspaceName || "—"}</TableCell>
                            <TableCell>
                              {row.tags.length === 0 ? (
                                <span className="text-muted-foreground">—</span>
                              ) : (
                                <div className="flex flex-wrap gap-1">
                                  {row.tags.map((t) => (
                                    <Badge key={t} variant="secondary">
                                      {t}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>{row.hasEmail ? "Sim" : "Não"}</TableCell>
                            <TableCell>{row.hasPhone ? "Sim" : "Não"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>
                      Página {currentPage + 1} de {totalPages}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={currentPage === 0}
                        onClick={() => setPage((p) => Math.max(0, p - 1))}
                      >
                        Anterior
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={currentPage >= totalPages - 1}
                        onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                      >
                        Próxima
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
