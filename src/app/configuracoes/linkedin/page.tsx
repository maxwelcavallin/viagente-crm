import { db } from "@/db";
import { leaddeltaSettings } from "@/db/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { decryptCredential, maskCredential } from "@/lib/credentials-crypto";
import { LinkedinSettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";

export default async function LinkedinSettingsPage() {
  const [settings] = await db.select().from(leaddeltaSettings).limit(1);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">LinkedIn (LeadDelta)</h1>
      <Card>
        <CardHeader>
          <CardTitle>Configuração</CardTitle>
        </CardHeader>
        <CardContent>
          <LinkedinSettingsForm
            maskedApiKey={settings ? maskCredential(decryptCredential(settings.apiKey)) : null}
            lastSyncedAt={settings?.lastSyncedAt?.toISOString() ?? null}
          />
        </CardContent>
      </Card>
    </div>
  );
}
