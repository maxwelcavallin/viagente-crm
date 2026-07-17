// Lógica de negócio da Etapa 20 (LinkedIn via LeadDelta) — porte fiel de
// `analytics.py` do projeto de referência (C:\Users\Obra Prima\Documents\Maxwel\Maxwel\DEV\leaddelta-dashboard).
// Não reinventar regras aqui: qualquer mudança de mapeamento tag→estágio,
// detecção de perfil ou normalização de localização deve espelhar a
// referência, senão os números da página divergem do dashboard original.

import type { LeadDeltaApiConnection } from "./leaddelta-client";

export type LeadDeltaProfile = "Perfil 1" | "Perfil 2" | "Sem perfil";

// Tags automáticas do LeadDelta, excluídas de qualquer visualização.
export const AUTO_TAGS = new Set(["LinkedIn", "LinkedIn 1st", "Imported"]);

export const P1_TAGS = new Set([
  "Prosp. 1 - 2.0",
  "Prosp. 2 - 2.0",
  "Prosp. 3 - 2.0",
  "Prosp. 4 - 2.0",
  "Prosp. 5 - 2.0",
  "Em contato",
  "Reuniao",
  "Em negociacao",
  "Fechado",
  "Interesse futuro",
  "Nao converteu",
  "Tentativas esgotadas",
  "Sem interesse",
  "Clint",
  "Base",
]);

export const FUNNEL_STAGES: Record<string, string[]> = {
  "Prospeccao 1": ["Prosp. 1 - 2.0", "Prospeccao 1 - P2"],
  "Prospeccao 2": ["Prosp. 2 - 2.0", "Prospeccao 2 - P2"],
  "Prospeccao 3": ["Prosp. 3 - 2.0", "Prospeccao 3 - P2"],
  "Prospeccao 4": ["Prosp. 4 - 2.0", "Prospeccao 4 - P2"],
  "Prospeccao 5": ["Prosp. 5 - 2.0", "Prospeccao 5 - P2"],
  "Em contato": ["Em contato", "Conexao - P2"],
  Reuniao: ["Reuniao", "Reuniao - P2"],
  "Em negociacao": ["Em negociacao"],
  Fechado: ["Fechado"],
};

export const NEGATIVE_EXITS: Record<string, string[]> = {
  "Sem interesse": ["Sem interesse", "Sem interesse - P2"],
  "Nao converteu": ["Nao converteu"],
  "Tentativas esgotadas": ["Tentativas esgotadas"],
  "Sem perfil": ["Sem perfil", "Sem perfil - P2"],
};

export const MAINTENANCE: Record<string, string[]> = {
  "Interesse futuro": ["Interesse futuro"],
  Base: ["Base"],
  Clint: ["Clint", "Clint - P2"],
};

export const FUNNEL_ACTIVE = Object.keys(FUNNEL_STAGES);

const STAGE_ORDER = [
  ...Object.keys(FUNNEL_STAGES).reverse(),
  ...Object.keys(MAINTENANCE),
  ...Object.keys(NEGATIVE_EXITS),
];

const TAG_TO_STAGE = new Map<string, string>();
for (const [stage, tagList] of Object.entries({
  ...FUNNEL_STAGES,
  ...MAINTENANCE,
  ...NEGATIVE_EXITS,
})) {
  for (const t of tagList) TAG_TO_STAGE.set(t, stage);
}

// Mapeamento de tags com acento para a versão sem acento (compatibilidade).
const ACCENT_MAP: Record<string, string> = {
  "Prospecção 1 - P2": "Prospeccao 1 - P2",
  "Prospecção 2 - P2": "Prospeccao 2 - P2",
  "Prospecção 3 - P2": "Prospeccao 3 - P2",
  "Prospecção 4 - P2": "Prospeccao 4 - P2",
  "Prospecção 5 - P2": "Prospeccao 5 - P2",
  Reunião: "Reuniao",
  "Reunião - P2": "Reuniao - P2",
  "Em negociação": "Em negociacao",
  "Não converteu": "Nao converteu",
  Prospecção: "Prospeccao",
  "Conexão - P2": "Conexao - P2",
  "Clint - P2": "Clint - P2",
};

function normalizeTag(t: string): string {
  return ACCENT_MAP[t] ?? t;
}

export function filterAutoTags(rawTags: string[]): string[] {
  return rawTags.filter((t) => !AUTO_TAGS.has(t));
}

export function detectProfile(tags: string[]): LeadDeltaProfile {
  const norm = tags.map(normalizeTag);
  const hasP2 = norm.some((t) => t.trim().endsWith("- P2"));
  const hasP1 = norm.some((t) => P1_TAGS.has(t.trim()));
  if (hasP2) return "Perfil 2";
  if (hasP1) return "Perfil 1";
  return "Sem perfil";
}

export function detectFunnelStage(tags: string[]): string {
  const norm = tags.map(normalizeTag);
  const matched = new Set(norm.filter((t) => TAG_TO_STAGE.has(t)).map((t) => TAG_TO_STAGE.get(t)!));
  if (matched.size === 0) return "Sem estágio";
  for (const s of STAGE_ORDER) {
    if (matched.has(s)) return s;
  }
  return matched.values().next().value as string;
}

export function normalizeLocation(loc: string): string {
  if (!loc || !loc.trim()) return loc;
  const value = loc.replaceAll("Brazil", "Brasil").replaceAll("brazil", "brasil");
  const parts = value
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return value;
  parts[0] = parts[0].replace(/^Greater\s+(.+?)\s+Area$/i, "$1");
  if (parts.length === 3) {
    const [city, state, country] = parts;
    if (city.toLowerCase() === state.toLowerCase()) return `${city}, ${country}`;
    return `${city}, ${state}, ${country}`;
  }
  return parts.join(", ");
}

// ---------- Tipo de conexão sincronizada (espelha leaddelta_connections) ----------

export type StoredConnection = {
  id: string;
  leaddeltaId: string;
  firstName: string;
  lastName: string;
  headline: string;
  company: string;
  jobTitle: string;
  location: string;
  locationNormalized: string;
  email: string;
  linkedinUrl: string;
  workspaceName: string;
  tags: string[];
  funnelStage: string;
  profile: LeadDeltaProfile;
  hasEmail: boolean;
  hasNotes: boolean;
  hasPhone: boolean;
  connectedAt: Date | null;
};

// ---------- Construção do registro a partir do payload cru da API ----------
// Espelha `build_dataframe` de analytics.py, linha a linha, pra virar uma
// linha pronta pra upsert em leaddelta_connections.

export function buildConnectionRecord(raw: LeadDeltaApiConnection): Omit<StoredConnection, "id"> {
  const rawTags = (raw.tagsArray ?? []).map((t) => t.title ?? "");
  const tags = filterAutoTags(rawTags);
  const location = raw.location ?? "";
  const firstName = raw.firstName ?? "";
  const lastName = raw.lastName ?? "";
  return {
    leaddeltaId: raw._id,
    firstName,
    lastName,
    headline: raw.headline ?? "",
    company: raw.company ?? "",
    jobTitle: raw.jobTitle ?? "",
    location,
    locationNormalized: normalizeLocation(location),
    email: raw.email ?? "",
    linkedinUrl: raw.linkedinUrl ?? "",
    workspaceName: raw.workspaceName ?? "",
    tags,
    funnelStage: detectFunnelStage(tags),
    profile: detectProfile(tags),
    hasEmail: Boolean(raw.email),
    hasNotes: Boolean(raw.notes),
    hasPhone: Boolean(raw.phoneNumber),
    connectedAt: raw.connectedAt ? new Date(raw.connectedAt) : null,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function pct(n: number, d: number): number | null {
  return d ? round1((n / d) * 100) : null;
}

// ---------- KPIs gerais ----------

export function kpis(rows: StoredConnection[]) {
  const total = rows.length;
  const withEmail = rows.filter((r) => r.hasEmail).length;
  const withNotes = rows.filter((r) => r.hasNotes).length;
  const tagged = rows.filter((r) => r.tags.length > 0).length;
  const companies = new Set(rows.map((r) => r.company).filter(Boolean)).size;
  return {
    total,
    withEmail,
    emailPct: total ? round1((withEmail / total) * 100) : 0,
    withNotes,
    tagged,
    untagged: total - tagged,
    companies,
  };
}

// ---------- Tags / pipeline (contagem por estágio canônico) ----------

export function tagsDistribution(rows: StoredConnection[]): { tag: string; count: number }[] {
  const counter = new Map<string, number>();
  let untagged = 0;
  for (const row of rows) {
    if (row.tags.length === 0) {
      untagged++;
      continue;
    }
    const seenStages = new Set<string>();
    for (const t of row.tags) {
      if (!t) continue;
      const norm = normalizeTag(t);
      const canonical = TAG_TO_STAGE.get(norm) ?? norm;
      if (!seenStages.has(canonical)) {
        seenStages.add(canonical);
        counter.set(canonical, (counter.get(canonical) ?? 0) + 1);
      }
    }
  }
  const result = Array.from(counter.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([tag, count]) => ({ tag, count }));
  if (untagged) result.push({ tag: "Sem tag", count: untagged });
  return result;
}

// ---------- Empresas ----------

export function topCompanies(rows: StoredConnection[], n = 20): { company: string; count: number }[] {
  const counter = new Map<string, number>();
  for (const row of rows) {
    if (!row.company) continue;
    counter.set(row.company, (counter.get(row.company) ?? 0) + 1);
  }
  return Array.from(counter.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([company, count]) => ({ company, count }));
}

// ---------- Localizações (locationNormalized já calculado na sincronização) ----------

export function topLocations(rows: StoredConnection[], n = 15): { location: string; count: number }[] {
  const counter = new Map<string, number>();
  for (const row of rows) {
    if (!row.locationNormalized) continue;
    counter.set(row.locationNormalized, (counter.get(row.locationNormalized) ?? 0) + 1);
  }
  return Array.from(counter.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([location, count]) => ({ location, count }));
}

// ---------- Conexões ao longo do tempo ----------

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function connectionsOverTime(
  rows: StoredConnection[]
): { month: string; count: number; cumulative: number }[] {
  const valid = rows.filter((r) => r.connectedAt);
  if (valid.length === 0) return [];
  const counter = new Map<string, number>();
  for (const row of valid) {
    const key = monthKey(row.connectedAt!);
    counter.set(key, (counter.get(key) ?? 0) + 1);
  }
  const months = Array.from(counter.keys()).sort();
  let cumulative = 0;
  return months.map((month) => {
    const count = counter.get(month)!;
    cumulative += count;
    return { month, count, cumulative };
  });
}

// ---------- Workspaces ----------

export function workspaceDistribution(rows: StoredConnection[]): { workspace: string; count: number }[] {
  const counter = new Map<string, number>();
  for (const row of rows) {
    const ws = row.workspaceName || "Sem workspace";
    counter.set(ws, (counter.get(ws) ?? 0) + 1);
  }
  return Array.from(counter.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([workspace, count]) => ({ workspace, count }));
}

// ---------- Cruzamento workspace x tag ----------

export function pipelineByWorkspace(
  rows: StoredConnection[]
): { workspace: string; tag: string; count: number }[] {
  const counter = new Map<string, { workspace: string; tag: string; count: number }>();
  for (const row of rows) {
    const ws = row.workspaceName || "Sem workspace";
    const tags = row.tags.length > 0 ? row.tags : ["Sem tag"];
    for (const t of tags) {
      const key = JSON.stringify([ws, t]);
      const existing = counter.get(key);
      if (existing) existing.count++;
      else counter.set(key, { workspace: ws, tag: t, count: 1 });
    }
  }
  return Array.from(counter.values()).sort((a, b) =>
    a.workspace === b.workspace ? b.count - a.count : a.workspace.localeCompare(b.workspace)
  );
}

// ---------- Filtro global por perfil ----------

export function filterByProfile(rows: StoredConnection[], profile?: string | null): StoredConnection[] {
  if (profile === "Perfil 1" || profile === "Perfil 2") {
    return rows.filter((r) => r.profile === profile);
  }
  return rows;
}

function funnelRows(rows: StoredConnection[], profile?: string | null): StoredConnection[] {
  const fdf = rows.filter((r) => r.profile === "Perfil 1" || r.profile === "Perfil 2");
  if (profile === "Perfil 1" || profile === "Perfil 2") {
    return fdf.filter((r) => r.profile === profile);
  }
  return fdf;
}

// ---------- Funil SDR ----------

export function funnelKpis(rows: StoredConnection[], profile?: string | null) {
  const fdf = funnelRows(rows, profile);
  const total = fdf.length;
  const activeStages = FUNNEL_ACTIVE.filter((s) => s !== "Fechado");
  const ativos = fdf.filter((r) => activeStages.includes(r.funnelStage)).length;
  const fechados = fdf.filter((r) => r.funnelStage === "Fechado").length;
  const saidas = fdf.filter((r) => Object.keys(NEGATIVE_EXITS).includes(r.funnelStage)).length;
  const fora = rows.filter((r) => r.profile === "Sem perfil").length;
  return {
    totalLeads: total,
    ativos,
    fechados,
    taxaConversao: total ? round1((fechados / total) * 100) : 0,
    saidasNegativas: saidas,
    foraFunil: fora,
  };
}

export function funnelUnified(
  rows: StoredConnection[],
  profile?: string | null
): { stage: string; count: number; conversionRate: number | null }[] {
  const fdf = funnelRows(rows, profile);
  const result: { stage: string; count: number; conversionRate: number | null }[] = [];
  let prevCount: number | null = null;
  for (const stageName of Object.keys(FUNNEL_STAGES)) {
    const count = fdf.filter((r) => r.funnelStage === stageName).length;
    const conversionRate = prevCount ? round1((count / prevCount) * 100) : null;
    result.push({ stage: stageName, count, conversionRate });
    prevCount = count;
  }
  return result;
}

export function funnelExits(
  rows: StoredConnection[],
  profile?: string | null
): { stage: string; count: number }[] {
  const fdf = funnelRows(rows, profile);
  return Object.keys(NEGATIVE_EXITS).map((s) => ({
    stage: s,
    count: fdf.filter((r) => r.funnelStage === s).length,
  }));
}

export function funnelComparison(rows: StoredConnection[]) {
  return (["Perfil 1", "Perfil 2"] as const).map((profile) => {
    const pRows = rows.filter((r) => r.profile === profile);
    const total = pRows.length;
    const closed = pRows.filter((r) => r.funnelStage === "Fechado").length;
    const active = pRows.filter((r) => FUNNEL_ACTIVE.includes(r.funnelStage)).length;
    const stages = Object.fromEntries(
      FUNNEL_ACTIVE.map((s) => [s, pRows.filter((r) => r.funnelStage === s).length])
    );
    return {
      profile,
      total,
      activeFunnel: active,
      closed,
      conversionRate: total ? round1((closed / total) * 100) : 0,
      stages,
    };
  });
}

type SdrStage = { stage: string; count: number; pctTopo: number | null; pctPrev: number | null };

export function funnelSdrOverview(
  rows: StoredConnection[],
  profile?: string | null
): { stages: SdrStage[]; totalInFunnel: number; conversionRate: number | null } {
  const base =
    profile === "Perfil 1" || profile === "Perfil 2"
      ? rows.filter((r) => r.profile === profile)
      : rows;

  const hasAny = (tags: string[], target: Set<string>) =>
    tags.some((t) => target.has(normalizeTag(t)));

  const n1 = base.filter((r) => r.profile === "Perfil 1" || r.profile === "Perfil 2").length;

  const S2 = new Set([
    "Em contato",
    "Reuniao",
    "Fechado",
    "Clint",
    "Sem interesse",
    "Nao converteu",
    "Sem perfil",
    "Interesse futuro",
    "Conexao - P2",
    "Reuniao - P2",
    "Fechado - P2",
    "Clint - P2",
    "Sem interesse - P2",
    "Sem perfil - P2",
  ]);
  const n2 = base.filter((r) => hasAny(r.tags, S2)).length;

  const S3 = new Set(["Reuniao", "Fechado", "Nao converteu", "Reuniao - P2", "Fechado - P2"]);
  const n3 = base.filter((r) => hasAny(r.tags, S3)).length;

  const S4 = new Set(["Fechado", "Fechado - P2"]);
  const n4 = base.filter((r) => hasAny(r.tags, S4)).length;

  const stages: SdrStage[] = [
    { stage: "Entrada", count: n1, pctTopo: n1 ? 100 : null, pctPrev: null },
    { stage: "Contato realizado", count: n2, pctTopo: pct(n2, n1), pctPrev: pct(n2, n1) },
    { stage: "Reunião", count: n3, pctTopo: pct(n3, n1), pctPrev: pct(n3, n2) },
    { stage: "Fechado", count: n4, pctTopo: pct(n4, n1), pctPrev: pct(n4, n3) },
  ];

  return { stages, totalInFunnel: n1, conversionRate: pct(n4, n1) };
}
