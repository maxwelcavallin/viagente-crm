import { db } from "@/db";
import { emailSettings } from "@/db/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { decryptCredential, maskCredential } from "@/lib/credentials-crypto";
import { EmailSettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";

export default async function EmailSettingsPage() {
  const [row] = await db.select().from(emailSettings).limit(1);

  const settings = row
    ? {
        fromAddress: row.fromAddress,
        fromName: row.fromName,
        provider: row.provider,
        maskedApiKey: maskCredential(decryptCredential(row.apiKey)),
      }
    : null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Email</h1>
      <p className="text-sm text-muted-foreground">
        Configura o remetente usado pra enviar emails a partir de um negócio (tarefas do
        tipo email e envio avulso) — só envio, não é um canal de atendimento.
      </p>
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Remetente</CardTitle>
        </CardHeader>
        <CardContent>
          <EmailSettingsForm settings={settings} />
        </CardContent>
      </Card>
    </div>
  );
}
