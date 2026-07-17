import { randomBytes } from "crypto";
import { db } from "@/db";
import { instagramChannels } from "@/db/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { getBaseUrl } from "@/lib/base-url";
import { getInstagramAuthorizeUrl } from "@/lib/instagram-graph";
import { ChannelsList, type InstagramChannelRow } from "./channels-list";

const ERROR_MESSAGES: Record<string, string> = {
  sem_code: "A conexão foi cancelada ou o Meta não retornou o código de autorização.",
  falha_conexao: "Falha ao conectar a conta. Tente novamente.",
};

export default async function InstagramChannelsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const rows = await db
    .select({
      id: instagramChannels.id,
      label: instagramChannels.label,
      username: instagramChannels.username,
      status: instagramChannels.status,
      isDefault: instagramChannels.isDefault,
    })
    .from(instagramChannels)
    .orderBy(instagramChannels.createdAt);

  const channels: InstagramChannelRow[] = rows;

  const baseUrl = await getBaseUrl();
  const redirectUri = `${baseUrl}/api/instagram/oauth/callback`;
  const webhookUrl = `${baseUrl}/api/instagram/webhook`;

  // INSTAGRAM_APP_ID ainda não configurado (variável de ambiente, feito
  // manualmente na Vercel/`.env.local`) — mostra a URL de webhook mesmo
  // assim, só sem o botão de conectar.
  let authorizeUrl: string | null = null;
  try {
    authorizeUrl = getInstagramAuthorizeUrl(redirectUri, randomBytes(16).toString("hex"));
  } catch {
    authorizeUrl = null;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Canais Instagram</h1>
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Canais configurados</CardTitle>
          </CardHeader>
          <CardContent>
            {error && (
              <p className="mb-4 text-sm text-destructive">
                {ERROR_MESSAGES[error] ?? "Falha ao conectar a conta."}
              </p>
            )}
            <ChannelsList channels={channels} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Conectar conta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              A conta do Instagram precisa ser profissional (Business ou Criador de
              conteúdo) e estar cadastrada como testadora no app do Meta usado por
              este CRM — não precisa de Página do Facebook vinculada.
            </p>
            {authorizeUrl ? (
              // <a> proposital em vez de <Link>: navega pro Meta, fora do
              // app — mesmo raciocínio de google-connection-card.tsx.
              <a href={authorizeUrl} className={buttonVariants({ variant: "default" })}>
                Conectar conta do Instagram
              </a>
            ) : (
              <p className="text-sm text-destructive">
                INSTAGRAM_APP_ID não configurado — defina a variável de ambiente antes de
                conectar uma conta.
              </p>
            )}
            <div className="space-y-1 border-t border-border pt-4">
              <p className="text-xs font-medium text-muted-foreground">
                URL de webhook (configurar uma vez, no painel do app do Meta)
              </p>
              <div className="rounded-lg border border-border bg-muted p-2">
                <code className="font-mono text-xs break-all">{webhookUrl}</code>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
