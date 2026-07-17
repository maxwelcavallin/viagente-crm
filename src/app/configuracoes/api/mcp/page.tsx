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
            , crie uma chave com o escopo adequado — <strong>Operacional</strong> cobre negócios,
            contatos, tarefas, mensagens e emails do dia a dia (leitura e escrita); <strong>Admin</strong>{" "}
            também libera configurar o CRM (pipelines, campos, tags, templates, automações e
            webhooks). Toda chamada de escrita fica registrada com a chave usada.
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
        <CardContent className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-medium">Sempre disponíveis (qualquer chave válida)</p>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              <li>
                <code className="font-mono text-foreground">listar_negocios</code>,{" "}
                <code className="font-mono text-foreground">detalhar_negocio</code>,{" "}
                <code className="font-mono text-foreground">historico_conversa_negocio</code>,{" "}
                <code className="font-mono text-foreground">criar_negocio</code>,{" "}
                <code className="font-mono text-foreground">editar_negocio</code>,{" "}
                <code className="font-mono text-foreground">mover_negocio_etapa</code>,{" "}
                <code className="font-mono text-foreground">adicionar_tag_negocio</code>,{" "}
                <code className="font-mono text-foreground">remover_tag_negocio</code>,{" "}
                <code className="font-mono text-foreground">enviar_email_negocio</code>
              </li>
              <li>
                <code className="font-mono text-foreground">listar_contatos</code>,{" "}
                <code className="font-mono text-foreground">detalhar_contato</code>,{" "}
                <code className="font-mono text-foreground">criar_contato</code>,{" "}
                <code className="font-mono text-foreground">editar_contato</code>
              </li>
              <li>
                <code className="font-mono text-foreground">listar_tarefas</code>,{" "}
                <code className="font-mono text-foreground">criar_tarefa</code>,{" "}
                <code className="font-mono text-foreground">concluir_tarefa</code>,{" "}
                <code className="font-mono text-foreground">enviar_mensagem_whatsapp</code>
              </li>
            </ul>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">Só com chave Admin (configuração do CRM)</p>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              <li>Pipelines e etapas: criar/editar/excluir/listar, incluindo tarefas automáticas de etapa</li>
              <li>Campos customizados, tags, templates de mensagem e email: CRUD completo</li>
              <li>Automações de tag e sequências de automação: CRUD completo</li>
              <li>Webhooks de entrada e saída: CRUD completo</li>
              <li>
                <code className="font-mono text-foreground">listar_canais</code> — status dos canais
                conectados (nunca inclui credenciais)
              </li>
            </ul>
          </div>
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
