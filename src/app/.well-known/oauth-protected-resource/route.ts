import { getOAuthBaseUrl } from "@/lib/mcp-oauth";

export const dynamic = "force-dynamic";

// RFC 9728 — metadados do "protected resource" (o servidor MCP em si). O
// 401 de /api/mcp aponta pra essa URL via WWW-Authenticate; esse endpoint
// também fica disponível pra probing direto, caso o cliente MCP prefira
// checar aqui antes de bater no servidor.
export async function GET() {
  const baseUrl = getOAuthBaseUrl();

  return Response.json(
    {
      resource: `${baseUrl}/api/mcp`,
      authorization_servers: [baseUrl],
    },
    { headers: { "cache-control": "no-store" } }
  );
}
