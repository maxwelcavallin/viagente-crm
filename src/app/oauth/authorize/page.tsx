import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getOAuthClient } from "@/lib/mcp-oauth";
import { authorizeConsentAction } from "./actions";

export const dynamic = "force-dynamic";

function ErrorCard({ title, description }: { title: string; description: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-lg">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
      </Card>
    </main>
  );
}

// Tela de consentimento do fluxo OAuth (ver src/lib/mcp-oauth.ts) — o
// claude.ai redireciona o navegador do admin pra cá depois de registrar o
// cliente via DCR. Roda dentro da sessão já logada do CRM (proxy.ts exige
// login antes de chegar aqui); só falta o admin escolher o escopo da API
// key que vai ser criada pro conector.
export default async function OAuthAuthorizePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const {
    response_type: responseType,
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: codeChallengeMethod,
  } = params;

  if (responseType !== "code" || !clientId || !redirectUri || !codeChallenge) {
    return (
      <ErrorCard
        title="Requisição OAuth inválida"
        description="Faltam parâmetros obrigatórios (response_type, client_id, redirect_uri ou code_challenge)."
      />
    );
  }

  if (codeChallengeMethod !== "S256") {
    return (
      <ErrorCard
        title="Requisição OAuth inválida"
        description="Este servidor só aceita PKCE com code_challenge_method=S256."
      />
    );
  }

  const client = await getOAuthClient(clientId);
  if (!client) {
    return (
      <ErrorCard title="Cliente não reconhecido" description="Esse client_id não está registrado neste servidor." />
    );
  }

  if (!client.redirectUris.includes(redirectUri)) {
    return (
      <ErrorCard
        title="redirect_uri não confere"
        description="O redirect_uri informado não bate com o registrado por esse cliente."
      />
    );
  }

  const session = await auth();
  if (!session?.user) redirect("/login");

  if (session.user.role !== "admin") {
    return (
      <ErrorCard
        title="Acesso restrito"
        description="Só administradores podem conectar um agente de IA ao CRM via MCP."
      />
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-lg">Conectar {client.clientName ?? "cliente MCP"} ao CRM</CardTitle>
          <CardDescription>
            Logado como <strong>{session.user.name}</strong>. Escolha o escopo da API key que será criada pra esse
            conector — a mesma distinção usada em Configurações → API.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={authorizeConsentAction} className="space-y-4">
            <input type="hidden" name="client_id" value={clientId} />
            <input type="hidden" name="redirect_uri" value={redirectUri} />
            <input type="hidden" name="code_challenge" value={codeChallenge} />
            {state && <input type="hidden" name="state" value={state} />}

            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                <strong>Operacional</strong>: negócios, contatos, tarefas, mensagens e emails do dia a dia.
              </p>
              <p>
                <strong>Admin</strong>: tudo do operacional + configurar o CRM (pipelines, campos, tags, templates,
                automações, webhooks).
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="submit" name="scope" value="operacional">
                Autorizar (Operacional)
              </Button>
              <Button type="submit" name="scope" value="admin" variant="outline">
                Autorizar (Admin)
              </Button>
              <Button type="submit" name="scope" value="cancel" variant="ghost">
                Cancelar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
