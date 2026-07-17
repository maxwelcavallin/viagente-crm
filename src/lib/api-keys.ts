import { createHash, randomBytes } from "node:crypto";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { apiKeys, users } from "@/db/schema";
import type { VisibilityUser } from "@/lib/visibility";

export type ApiScope = "operacional" | "admin";

// Admin é mais restrito por natureza (configura o CRM inteiro, não só o dia
// a dia) — limite mais baixo é intencional, não um bug.
const RATE_LIMIT_PER_MINUTE: Record<ApiScope, number> = {
  operacional: 120,
  admin: 30,
};

// Prefixo só pra reconhecimento visual (tipo sk_live_ da Stripe) — não tem
// função criptográfica, ajuda a identificar a chave em logs/scanners de
// segredo vazado.
const KEY_PREFIX = "vgt_";

function hashKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

export function generateApiKey(): { rawKey: string; keyHash: string } {
  const rawKey = KEY_PREFIX + randomBytes(24).toString("hex");
  return { rawKey, keyHash: hashKey(rawKey) };
}

export async function createApiKey(params: {
  label: string;
  scope: ApiScope;
  createdByUserId: string;
}): Promise<{ id: string; rawKey: string }> {
  const { rawKey, keyHash } = generateApiKey();
  const [created] = await db
    .insert(apiKeys)
    .values({
      label: params.label,
      keyHash,
      scope: params.scope,
      createdByUserId: params.createdByUserId,
    })
    .returning({ id: apiKeys.id });
  return { id: created.id, rawKey };
}

export async function listApiKeys() {
  return db
    .select({
      id: apiKeys.id,
      label: apiKeys.label,
      scope: apiKeys.scope,
      active: apiKeys.active,
      lastUsedAt: apiKeys.lastUsedAt,
      createdAt: apiKeys.createdAt,
      createdByName: users.name,
    })
    .from(apiKeys)
    .innerJoin(users, eq(apiKeys.createdByUserId, users.id))
    .orderBy(desc(apiKeys.createdAt));
}

export async function setApiKeyActive(id: string, active: boolean): Promise<void> {
  await db.update(apiKeys).set({ active }).where(eq(apiKeys.id, id));
}

export type AuthenticatedApiKey = {
  id: string;
  scope: ApiScope;
  actingUser: VisibilityUser;
};

export type ApiAuthResult =
  | { ok: true; apiKey: AuthenticatedApiKey }
  | { ok: false; status: 401 | 429; error: string };

function extractBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return token || null;
}

// Ponto único de autenticação pra API pública e servidor MCP (Etapa 28) —
// resolve a chave, confere se está ativa, aplica rate limit, e devolve o
// "usuário agindo" (o admin/atendente dono da chave) pra reaproveitar as
// mesmas regras de visibilidade (ownerVisibilityFilter/canViewOwnedRecord)
// já usadas nas telas, em vez de inventar um modelo de permissão paralelo.
export async function authenticateApiRequest(request: Request): Promise<ApiAuthResult> {
  const token = extractBearerToken(request);
  if (!token) return { ok: false, status: 401, error: "Header Authorization: Bearer ausente." };

  const keyHash = hashKey(token);
  const [row] = await db
    .select({
      id: apiKeys.id,
      scope: apiKeys.scope,
      active: apiKeys.active,
      rateLimitWindowStart: apiKeys.rateLimitWindowStart,
      userId: users.id,
      role: users.role,
      restrictToOwnRecords: users.restrictToOwnRecords,
    })
    .from(apiKeys)
    .innerJoin(users, eq(apiKeys.createdByUserId, users.id))
    .where(eq(apiKeys.keyHash, keyHash))
    .limit(1);

  if (!row || !row.active) {
    return { ok: false, status: 401, error: "API key inválida ou revogada." };
  }

  const withinLimit = await checkAndTouchRateLimit(row.id, row.scope as ApiScope);
  if (!withinLimit) {
    return { ok: false, status: 429, error: "Rate limit excedido — tente novamente em instantes." };
  }

  void db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, row.id));

  return {
    ok: true,
    apiKey: {
      id: row.id,
      scope: row.scope as ApiScope,
      actingUser: {
        id: row.userId,
        role: row.role,
        restrictToOwnRecords: row.restrictToOwnRecords,
      },
    },
  };
}

// Admin é superset de operacional — qualquer chave válida já passa nas
// ações "operacionais" (Part A da Etapa 28); só as ações de configuração
// (Part B) checam este helper.
export function hasAdminScope(apiKey: AuthenticatedApiKey): boolean {
  return apiKey.scope === "admin";
}

// Janela fixa de 1 minuto — reset atômico via CASE dentro do próprio UPDATE
// (uma única ida ao banco, sem race condition de leitura seguida de escrita
// separada). "Básico" o bastante pro estágio atual, sem depender de um
// Redis que este projeto não tem.
async function checkAndTouchRateLimit(apiKeyId: string, scope: ApiScope): Promise<boolean> {
  const [row] = await db
    .update(apiKeys)
    .set({
      rateLimitCount: sql`case when ${apiKeys.rateLimitWindowStart} is null or ${apiKeys.rateLimitWindowStart} <= now() - interval '1 minute' then 1 else ${apiKeys.rateLimitCount} + 1 end`,
      rateLimitWindowStart: sql`case when ${apiKeys.rateLimitWindowStart} is null or ${apiKeys.rateLimitWindowStart} <= now() - interval '1 minute' then now() else ${apiKeys.rateLimitWindowStart} end`,
    })
    .where(eq(apiKeys.id, apiKeyId))
    .returning({ count: apiKeys.rateLimitCount });
  return (row?.count ?? 0) <= RATE_LIMIT_PER_MINUTE[scope];
}
