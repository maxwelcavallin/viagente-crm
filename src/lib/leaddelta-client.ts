// Cliente da API LeadDelta — porte de `leaddelta_client.py` do projeto de
// referência. Busca todas as conexões com paginação completa (skip/limit),
// tratando 401 (key inválida) e 429 (rate limit, com espera e nova tentativa).
// Diferente da referência, não há cache local em arquivo aqui: os dados
// sincronizados moram em `leaddelta_connections` (ver decisão de arquitetura
// da Etapa 20), então cada chamada desta função busca tudo de novo na API.

const BASE_URL = "https://api.leaddelta.com/profiles/v1/public";
const PAGE_SIZE = 100;
const REQUEST_DELAY_MS = 300;
const RATE_LIMIT_WAIT_MS = 5000;
const REQUEST_TIMEOUT_MS = 60_000;

export type LeadDeltaApiTag = { title: string };

export type LeadDeltaApiConnection = {
  _id: string;
  firstName?: string;
  lastName?: string;
  headline?: string;
  company?: string;
  jobTitle?: string;
  location?: string;
  email?: string;
  linkedinUrl?: string;
  workspaceName?: string;
  tagsArray?: LeadDeltaApiTag[];
  notes?: string;
  phoneNumber?: string;
  connectedAt?: number;
};

export class LeadDeltaAuthError extends Error {
  constructor() {
    super("API Key inválida ou expirada.");
    this.name = "LeadDeltaAuthError";
  }
}

class LeadDeltaRateLimitError extends Error {}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Retorna null em caso de rate limit (429) — o chamador espera e tenta de novo.
async function fetchPage(apiKey: string, skip: number): Promise<LeadDeltaApiConnection[]> {
  const url = new URL(BASE_URL);
  url.searchParams.set("skip", String(skip));
  url.searchParams.set("limit", String(PAGE_SIZE));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const resp = await fetch(url, {
      headers: { apikey: apiKey },
      signal: controller.signal,
    });

    if (resp.status === 401) throw new LeadDeltaAuthError();
    if (resp.status === 429) throw new LeadDeltaRateLimitError();
    if (!resp.ok) {
      throw new Error(`Erro na API LeadDelta: ${resp.status} — ${await resp.text()}`);
    }

    const data = (await resp.json()) as { data?: { connections?: LeadDeltaApiConnection[] } };
    return data.data?.connections ?? [];
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchAllConnections(apiKey: string): Promise<LeadDeltaApiConnection[]> {
  const all: LeadDeltaApiConnection[] = [];
  let skip = 0;

  while (true) {
    let page: LeadDeltaApiConnection[];
    try {
      page = await fetchPage(apiKey, skip);
    } catch (err) {
      if (err instanceof LeadDeltaRateLimitError) {
        await sleep(RATE_LIMIT_WAIT_MS);
        continue;
      }
      throw err;
    }

    if (page.length === 0) break;
    all.push(...page);

    if (page.length < PAGE_SIZE) break; // página incompleta = fim real dos dados

    skip += PAGE_SIZE;
    await sleep(REQUEST_DELAY_MS);
  }

  return all;
}
