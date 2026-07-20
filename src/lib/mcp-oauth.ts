// Handshake OAuth 2.1 mínimo (DCR + PKCE, sem client secret nem refresh
// token) que faz o "Adicionar conector personalizado" do claude.ai
// conseguir conectar no nosso servidor MCP (/api/mcp) sem exigir que o
// admin cole uma API key manualmente — ver decisão em /oauth/authorize e
// src/app/api/oauth/*. O access_token devolvido é literalmente uma API key
// (ver src/lib/api-keys.ts), então revogar em Configurações → API já
// invalida o acesso, sem tabela de token paralela.
import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { mcpOauthClients, mcpOauthCodes } from "@/db/schema";
import type { ApiScope } from "@/lib/api-keys";

const CODE_EXPIRES_IN_MS = 5 * 60 * 1000;

export function getOAuthBaseUrl(): string {
  return process.env.APP_BASE_URL ?? "https://seu-dominio.com";
}

export function generateClientId(): string {
  return "mcpc_" + randomBytes(16).toString("hex");
}

function generateCode(): string {
  return randomBytes(32).toString("base64url");
}

export function verifyPkce(codeVerifier: string, codeChallenge: string): boolean {
  const computed = createHash("sha256").update(codeVerifier).digest("base64url");
  return computed === codeChallenge;
}

export async function registerOAuthClient(params: {
  clientName: string | null;
  redirectUris: string[];
}): Promise<{ clientId: string }> {
  const clientId = generateClientId();
  await db.insert(mcpOauthClients).values({
    id: clientId,
    clientName: params.clientName,
    redirectUris: params.redirectUris,
  });
  return { clientId };
}

export async function getOAuthClient(clientId: string) {
  const [row] = await db
    .select()
    .from(mcpOauthClients)
    .where(eq(mcpOauthClients.id, clientId))
    .limit(1);
  return row ?? null;
}

export async function createAuthorizationCode(params: {
  clientId: string;
  userId: string;
  redirectUri: string;
  codeChallenge: string;
  scope: ApiScope;
}): Promise<string> {
  const code = generateCode();
  await db.insert(mcpOauthCodes).values({
    code,
    clientId: params.clientId,
    userId: params.userId,
    redirectUri: params.redirectUri,
    codeChallenge: params.codeChallenge,
    scope: params.scope,
    expiresAt: new Date(Date.now() + CODE_EXPIRES_IN_MS),
  });
  return code;
}

export type ConsumeCodeResult =
  | {
      ok: true;
      code: {
        clientId: string;
        userId: string;
        redirectUri: string;
        codeChallenge: string;
        scope: ApiScope;
      };
    }
  | { ok: false; error: string };

// Marca o código como usado atomicamente (WHERE used_at IS NULL) — evita
// que uma corrida de duas trocas simultâneas do mesmo código gere duas API
// keys pro mesmo consentimento.
export async function consumeAuthorizationCode(code: string): Promise<ConsumeCodeResult> {
  const [row] = await db
    .update(mcpOauthCodes)
    .set({ usedAt: new Date() })
    .where(and(eq(mcpOauthCodes.code, code), isNull(mcpOauthCodes.usedAt)))
    .returning();

  if (!row) return { ok: false, error: "invalid_grant" };
  if (row.expiresAt.getTime() < Date.now()) return { ok: false, error: "invalid_grant" };

  return {
    ok: true,
    code: {
      clientId: row.clientId,
      userId: row.userId,
      redirectUri: row.redirectUri,
      codeChallenge: row.codeChallenge,
      scope: row.scope as ApiScope,
    },
  };
}
