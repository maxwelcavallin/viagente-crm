import { db } from "@/db";
import { whatsappChannels } from "@/db/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { decryptCredential, maskCredential } from "@/lib/credentials-crypto";
import { ChannelsList, type ChannelRow } from "./channels-list";
import { CreateChannelForm } from "./create-channel-form";

export default async function WhatsappChannelsPage() {
  const rows = await db
    .select({
      id: whatsappChannels.id,
      label: whatsappChannels.label,
      phoneNumber: whatsappChannels.phoneNumber,
      status: whatsappChannels.status,
      isDefault: whatsappChannels.isDefault,
      zapiToken: whatsappChannels.zapiToken,
      zapiClientToken: whatsappChannels.zapiClientToken,
    })
    .from(whatsappChannels)
    .orderBy(whatsappChannels.createdAt);

  // Descriptografa só o suficiente pra mascarar (últimos 4 caracteres) — o
  // valor em texto puro nunca sai do servidor.
  const channels: ChannelRow[] = rows.map((row) => ({
    id: row.id,
    label: row.label,
    phoneNumber: row.phoneNumber,
    status: row.status,
    isDefault: row.isDefault,
    maskedToken: maskCredential(decryptCredential(row.zapiToken)),
    maskedClientToken: maskCredential(decryptCredential(row.zapiClientToken)),
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Canais WhatsApp</h1>
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Canais configurados</CardTitle>
          </CardHeader>
          <CardContent>
            <ChannelsList channels={channels} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Novo canal</CardTitle>
          </CardHeader>
          <CardContent>
            <CreateChannelForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
