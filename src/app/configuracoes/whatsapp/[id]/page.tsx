import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { Users } from "lucide-react";
import { db } from "@/db";
import { users, whatsappChannelRestrictions, whatsappChannels } from "@/db/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { getBaseUrl } from "@/lib/base-url";
import { AccessToggle } from "./access-toggle";
import { RelayUrlForm } from "./relay-url-form";

export default async function ChannelAccessPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [channel] = await db
    .select({
      id: whatsappChannels.id,
      label: whatsappChannels.label,
      relayWebhookUrl: whatsappChannels.relayWebhookUrl,
    })
    .from(whatsappChannels)
    .where(eq(whatsappChannels.id, id))
    .limit(1);
  if (!channel) notFound();

  const baseUrl = await getBaseUrl();
  const webhookUrl = `${baseUrl}/api/whatsapp/webhook/${channel.id}`;

  const atendentes = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(eq(users.role, "atendente"))
    .orderBy(users.name);

  const restrictions = await db
    .select({ userId: whatsappChannelRestrictions.userId })
    .from(whatsappChannelRestrictions)
    .where(eq(whatsappChannelRestrictions.channelId, id));
  const blockedUserIds = new Set(restrictions.map((r) => r.userId));

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/configuracoes/whatsapp"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Canais WhatsApp
        </Link>
        <h1 className="text-2xl font-bold">{channel.label}</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>URL do webhook (Z-API)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Cole esta URL no painel da Z-API dessa instância, na aba{" "}
            <strong>Webhooks</strong>, tanto em &quot;Ao receber&quot; quanto
            em &quot;Status da mensagem&quot;.
          </p>
          <div className="rounded-lg border border-border bg-muted p-3 text-sm">
            <code className="font-mono text-xs break-all">{webhookUrl}</code>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Repasse pra outro sistema</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            A Z-API só aceita uma URL cadastrada por evento — se essa instância também
            for usada por outro sistema, cole a URL de webhook dele aqui. O CRM repassa
            uma cópia de cada evento recebido (mensagem e status) pra essa URL, sem afetar
            o processamento normal.
          </p>
          <RelayUrlForm channelId={channel.id} defaultValue={channel.relayWebhookUrl} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Acesso por atendente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Por padrão todo atendente tem acesso. Desmarque pra bloquear um
            atendente específico deste canal. Admins sempre têm acesso a
            todos os canais e por isso não aparecem aqui.
          </p>
          {atendentes.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Nenhum atendente cadastrado"
              description="Crie usuários com role atendente em /configuracoes/usuarios."
            />
          ) : (
            <div className="space-y-2">
              {atendentes.map((atendente) => (
                <div
                  key={atendente.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <div className="text-sm font-medium">{atendente.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {atendente.email}
                    </div>
                  </div>
                  <AccessToggle
                    channelId={channel.id}
                    userId={atendente.id}
                    defaultChecked={!blockedUserIds.has(atendente.id)}
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
