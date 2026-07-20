import { getOAuthBaseUrl } from "@/lib/mcp-oauth";

export const dynamic = "force-dynamic";

// RFC 8414 — metadados do "authorization server". O claude.ai descobre essa
// URL a partir de authorization_servers em /.well-known/oauth-protected-resource
// (ou probing direto, como fallback) e usa isso pra saber onde mandar o
// usuário autorizar e onde trocar o code por token.
export async function GET() {
  const baseUrl = getOAuthBaseUrl();

  return Response.json(
    {
      issuer: baseUrl,
      authorization_endpoint: `${baseUrl}/oauth/authorize`,
      token_endpoint: `${baseUrl}/api/oauth/token`,
      registration_endpoint: `${baseUrl}/api/oauth/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
      scopes_supported: ["operacional", "admin"],
    },
    { headers: { "cache-control": "no-store" } }
  );
}
