"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveApiKeyAction, type SaveApiKeyState } from "./actions";

const idleState: SaveApiKeyState = { status: "idle" };

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR");
}

export function LinkedinSettingsForm({
  maskedApiKey,
  lastSyncedAt,
}: {
  maskedApiKey: string | null;
  lastSyncedAt: string | null;
}) {
  const router = useRouter();
  const [state, formAction, isSaving] = useActionState(saveApiKeyAction, idleState);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<
    { status: "success"; count: number } | { status: "error"; message: string } | null
  >(null);

  async function handleSync() {
    setIsSyncing(true);
    setSyncResult(null);
    try {
      const resp = await fetch("/api/leaddelta/sync", { method: "POST" });
      const data = (await resp.json()) as { ok?: boolean; count?: number; message?: string };
      if (resp.ok && data.ok) {
        setSyncResult({ status: "success", count: data.count ?? 0 });
        router.refresh();
      } else {
        setSyncResult({ status: "error", message: data.message ?? "Falha na sincronização." });
      }
    } catch {
      setSyncResult({ status: "error", message: "Falha na sincronização." });
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <div className="space-y-6">
      <form action={formAction} className="space-y-4">
        {maskedApiKey && (
          <p className="text-sm text-muted-foreground">
            API Key atual: <span className="font-mono">{maskedApiKey}</span>
          </p>
        )}
        <div className="space-y-2">
          <Label htmlFor="apiKey">
            {maskedApiKey ? "Substituir API Key" : "API Key da LeadDelta"}
          </Label>
          <Input id="apiKey" name="apiKey" type="password" required />
        </div>
        {state.status === "error" && <p className="text-sm text-destructive">{state.message}</p>}
        <Button type="submit" disabled={isSaving}>
          {isSaving ? "Salvando..." : "Salvar"}
        </Button>
      </form>

      <div className="space-y-2 border-t border-border pt-4">
        <p className="text-sm text-muted-foreground">
          Última sincronização:{" "}
          {lastSyncedAt ? formatDateTime(lastSyncedAt) : "nunca sincronizado"}
        </p>
        <Button type="button" variant="outline" onClick={handleSync} disabled={isSyncing || !maskedApiKey}>
          <RefreshCw size={16} strokeWidth={1.75} className={isSyncing ? "animate-spin" : ""} />
          {isSyncing ? "Sincronizando..." : "Sincronizar agora"}
        </Button>
        {syncResult?.status === "success" && (
          <p className="text-sm text-status-success">
            {syncResult.count} conexões sincronizadas com sucesso.
          </p>
        )}
        {syncResult?.status === "error" && (
          <p className="text-sm text-destructive">{syncResult.message}</p>
        )}
      </div>
    </div>
  );
}
