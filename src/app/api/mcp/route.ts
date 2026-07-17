import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { authenticateApiRequest } from "@/lib/api-keys";
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
    return Response.json({ error: auth.error }, { status: auth.status });
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
