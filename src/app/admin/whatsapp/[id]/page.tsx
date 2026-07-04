import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { Users } from "lucide-react";
import { db } from "@/db";
import { users, whatsappChannelRestrictions, whatsappChannels } from "@/db/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { AccessToggle } from "./access-toggle";

export default async function ChannelAccessPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [channel] = await db
    .select({ id: whatsappChannels.id, label: whatsappChannels.label })
    .from(whatsappChannels)
    .where(eq(whatsappChannels.id, id))
    .limit(1);
  if (!channel) notFound();

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
          href="/admin/whatsapp"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Canais WhatsApp
        </Link>
        <h1 className="text-2xl font-bold">{channel.label}</h1>
      </div>
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
              description="Crie usuários com role atendente em /admin/usuarios."
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
