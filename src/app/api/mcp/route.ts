import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { authenticateApiRequest } from "@/lib/api-keys";
import { getOAuthBaseUrl } from "@/lib/mcp-oauth";
import { createMcpServer } from "@/lib/mcp-server";

export const dynamic = "force-dynamic";

// Servidor MCP remoto (Etapa 28), transporte Streamable HTTP em modo
// stateless: cada request cria um McpServer + transport novos (nada de
// sessão em memória entre chamadas — coerente com o ambiente serverless
// da Vercel, onde não há garantia de que a mesma instância atenda duas
// requisições seguidas). Autenticação por API key idêntica à REST — sem
// chave válida, nem chega a montar o servidor MCP.
async function handleMcpRequest(request: Request): Promise<Response> {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) {
    // WWW-Authenticate com resource_metadata é como o claude.ai descobre o
    // fluxo OAuth (ver /oauth/authorize) num 401 — sem isso, ele tenta
    // adivinhar endpoints e cai em 404 (ver src/app/api/oauth/*).
    const headers =
      auth.status === 401
        ? { "www-authenticate": `Bearer resource_metadata="${getOAuthBaseUrl()}/.well-known/oauth-protected-resource"` }
        : undefined;
    return Response.json({ error: auth.error }, { status: auth.status, headers });
  }

  const server = createMcpServer(auth.apiKey);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  await server.connect(transport);

  return transport.handleRequest(request);
}

export const GET = handleMcpRequest;
export const POST = handleMcpRequest;
export const DELETE = handleMcpRequest;
