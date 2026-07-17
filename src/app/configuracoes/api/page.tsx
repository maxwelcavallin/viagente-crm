import Link from "next/link";
import { listApiKeys } from "@/lib/api-keys";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiKeysTable } from "./api-keys-table";
import { CreateApiKeyForm } from "./create-api-key-form";

export const dynamic = "force-dynamic";

export default async function ApiSettingsPage() {
  const keys = await listApiKeys();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">API</h1>
      <p className="text-sm text-muted-foreground">
        Chaves de API pra integrar agentes de IA e sistemas externos com o CRM, via REST (
        <code className="font-mono">/api/v1/...</code>) ou pelo{" "}
        <Link href="/configuracoes/api/mcp" className="text-primary hover:underline">
          servidor MCP
        </Link>
        .
      </p>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Chaves criadas</CardTitle>
          </CardHeader>
          <CardContent>
            <ApiKeysTable
              apiKeys={keys.map((k) => ({
                ...k,
                lastUsedAt: k.lastUsedAt ? k.lastUsedAt.toISOString() : null,
                createdAt: k.createdAt.toISOString(),
              }))}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Nova chave</CardTitle>
          </CardHeader>
          <CardContent>
            <CreateApiKeyForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
