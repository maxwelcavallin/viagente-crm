import { createApiKey } from "@/lib/api-keys";
import { consumeAuthorizationCode, getOAuthClient, verifyPkce } from "@/lib/mcp-oauth";

export const dynamic = "force-dynamic";

// Troca o authorization code (Etapa 2 do fluxo, ver /oauth/authorize) por
// um access_token. Público de propósito — quem chama é o backend do
// claude.ai, sem sessão de navegador; a segurança vem do code de uso único
// + PKCE, não de uma sessão. O access_token devolvido é o rawKey de uma
// api_keys nova de verdade (ver createApiKey) — sem refresh_token nem
// expires_in de propósito: a chave não expira sozinha, só é revogada
// manualmente em Configurações → API, e sem expiração declarada o claude.ai
// não tenta renovar (ver "Token refresh" na doc de auth de conectores).
export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/x-www-form-urlencoded") && !contentType.includes("multipart/form-data")) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const form = await request.formData();
  const grantType = form.get("grant_type");
  if (grantType !== "authorization_code") {
    return Response.json({ error: "unsupported_grant_type" }, { status: 400 });
  }

  const code = form.get("code");
  const redirectUri = form.get("redirect_uri");
  const clientId = form.get("client_id");
  const codeVerifier = form.get("code_verifier");

  if (
    typeof code !== "string" ||
    typeof redirectUri !== "string" ||
    typeof clientId !== "string" ||
    typeof codeVerifier !== "string"
  ) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const result = await consumeAuthorizationCode(code);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  if (result.code.clientId !== clientId || result.code.redirectUri !== redirectUri) {
    return Response.json({ error: "invalid_grant" }, { status: 400 });
  }

  const client = await getOAuthClient(clientId);
  if (!client) {
    return Response.json({ error: "invalid_client" }, { status: 400 });
  }

  if (!verifyPkce(codeVerifier, result.code.codeChallenge)) {
    return Response.json({ error: "invalid_grant", error_description: "PKCE inválido." }, { status: 400 });
  }

  const { rawKey } = await createApiKey({
    label: `Conector MCP — ${client.clientName ?? "claude.ai"} (OAuth)`,
    scope: result.code.scope,
    createdByUserId: result.code.userId,
  });

  return Response.json(
    { access_token: rawKey, token_type: "Bearer", scope: result.code.scope },
    { headers: { "cache-control": "no-store" } }
  );
}
