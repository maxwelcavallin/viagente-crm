"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { saveEmailSettingsAction, type SaveEmailSettingsState } from "./actions";

const idleState: SaveEmailSettingsState = { status: "idle" };

const PROVIDER_LABELS: Record<string, string> = {
  resend: "Resend",
  postmark: "Postmark",
  sendgrid: "SendGrid",
};

export function EmailSettingsForm({
  settings,
}: {
  settings: {
    fromAddress: string;
    fromName: string;
    provider: "resend" | "postmark" | "sendgrid";
    maskedApiKey: string;
  } | null;
}) {
  const [state, formAction, isSaving] = useActionState(saveEmailSettingsAction, idleState);
  const [provider, setProvider] = useState<string>(settings?.provider ?? "resend");

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="provider" value={provider} />
      <div className="space-y-2">
        <Label htmlFor="fromAddress">Endereço de envio</Label>
        <Input
          id="fromAddress"
          name="fromAddress"
          type="email"
          placeholder="contato@viagente.com.br"
          defaultValue={settings?.fromAddress ?? ""}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="fromName">Nome do remetente</Label>
        <Input
          id="fromName"
          name="fromName"
          placeholder="Viagente"
          defaultValue={settings?.fromName ?? ""}
          required
        />
      </div>
      <div className="space-y-2">
        <Label>Provedor</Label>
        <Select
          items={PROVIDER_LABELS}
          value={provider}
          onValueChange={(v) => setProvider(v ?? "resend")}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(PROVIDER_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="apiKey">API key</Label>
        <Input
          id="apiKey"
          name="apiKey"
          type="password"
          placeholder={settings ? `Atual: ${settings.maskedApiKey}` : "Cole a API key"}
        />
        {settings && (
          <p className="text-xs text-muted-foreground">Deixe em branco pra manter a atual.</p>
        )}
      </div>
      {state.status === "error" && (
        <p className="text-sm text-destructive">{state.message}</p>
      )}
      <Button type="submit" disabled={isSaving}>
        {isSaving ? "Salvando..." : "Salvar"}
      </Button>
    </form>
  );
}
