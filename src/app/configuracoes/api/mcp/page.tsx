import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg border border-border bg-muted p-3 text-xs">
      <code className="font-mono">{children}</code>
    </pre>
  );
}

export default function McpDocsPage() {
  const baseUrl = process.env.APP_BASE_URL ?? "https://seu-dominio.com";
  const mcpUrl = `${baseUrl}/api/mcp`;

  return (
    <div className="space-y-6">
      <Link
        href="/configuracoes/api"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={16} strokeWidth={1.75} />
        API
      </Link>

      <div>
        <h1 className="text-2xl font-bold">Servidor MCP</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Conecte o CRM a Claude ou outro cliente MCP pra consultar e operar negócios, tarefas e
          mensagens diretamente de uma conversa com um agente de IA.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>1. Crie uma API key</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            Na aba{" "}
            <Link href="/configuracoes/api" className="text-primary hover:underline">
              API
            </Link>
            , crie uma chave com o escopo adequado — <strong>somente leitura</strong> se o agente só
            vai consultar, ou <strong>leitura e escrita</strong> se ele também vai mover negócios de
            etapa, criar/concluir tarefas ou enviar mensagens.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. URL do servidor</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <CodeBlock>{mcpUrl}</CodeBlock>
          <p className="text-muted-foreground">
            Toda chamada precisa do header <code className="font-mono">Authorization: Bearer &lt;sua chave&gt;</code>.
            Sem uma chave válida e ativa, o servidor responde 401 e não executa nenhuma ferramenta.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>3. Conectando no Claude (claude.ai / Claude Desktop)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            Em <strong>Configurações → Conectores → Adicionar conector personalizado</strong>, informe
            a URL acima e adicione um header customizado:
          </p>
          <CodeBlock>{`Authorization: Bearer <sua chave>`}</CodeBlock>
          <p className="text-muted-foreground">
            Se o cliente MCP que você está usando só suporta servidores locais (stdio), use a ponte{" "}
            <code className="font-mono">mcp-remote</code> na configuração:
          </p>
          <CodeBlock>{`{
  "mcpServers": {
    "viagente-crm": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "${mcpUrl}",
        "--header",
        "Authorization:Bearer \${VIAGENTE_API_KEY}"
      ],
      "env": {
        "VIAGENTE_API_KEY": "<sua chave>"
      }
    }
  }
}`}</CodeBlock>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ferramentas (tools) disponíveis</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            <li>
              <code className="font-mono">list_deals</code> — consultar negócios por pipeline, etapa,
              dono, status, temperatura, tag ou busca
            </li>
            <li>
              <code className="font-mono">get_deal</code> — detalhar um negócio específico
            </li>
            <li>
              <code className="font-mono">get_deal_conversation</code> — histórico de conversa do
              contato de um negócio
            </li>
            <li>
              <code className="font-mono">move_deal_stage</code> — mover negócio de etapa (escrita)
            </li>
            <li>
              <code className="font-mono">list_tasks</code> — listar tarefas de um negócio
            </li>
            <li>
              <code className="font-mono">create_task</code> — criar tarefa em um negócio (escrita)
            </li>
            <li>
              <code className="font-mono">complete_task</code> — marcar tarefa como concluída
              (escrita)
            </li>
            <li>
              <code className="font-mono">send_message</code> — enviar mensagem via WhatsApp
              (escrita)
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>API REST equivalente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="text-muted-foreground">
            Os mesmos dados e ações também estão disponíveis via REST, com a mesma API key:
          </p>
          <CodeBlock>{`curl -H "Authorization: Bearer <sua chave>" \\
  "${baseUrl}/api/v1/deals?status=aberto&stageId=..."`}</CodeBlock>
        </CardContent>
      </Card>
    </div>
  );
}
