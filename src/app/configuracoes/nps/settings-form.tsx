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
import { Switch } from "@/components/ui/switch";
import { saveNpsSettingsAction, type SaveNpsSettingsState } from "./actions";

const idleState: SaveNpsSettingsState = { status: "idle" };

export function NpsSettingsForm({
  settings,
  stages,
  channels,
  templates,
}: {
  settings: {
    active: boolean;
    triggerStageId: string | null;
    triggerOnWon: boolean;
    delayDays: number;
    channelId: string | null;
    messageTemplateId: string | null;
  } | null;
  stages: { id: string; label: string }[];
  channels: { id: string; label: string }[];
  templates: { id: string; name: string }[];
}) {
  const [state, formAction, isSaving] = useActionState(saveNpsSettingsAction, idleState);
  const [active, setActive] = useState(settings?.active ?? false);
  const [triggerOnWon, setTriggerOnWon] = useState(settings?.triggerOnWon ?? true);
  const [triggerStageId, setTriggerStageId] = useState<string | null>(
    settings?.triggerStageId ?? null
  );
  const [channelId, setChannelId] = useState<string | null>(settings?.channelId ?? null);
  const [messageTemplateId, setMessageTemplateId] = useState<string | null>(
    settings?.messageTemplateId ?? null
  );

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="active" value={active ? "on" : ""} />
      <input type="hidden" name="triggerOnWon" value={triggerOnWon ? "on" : ""} />
      <input type="hidden" name="triggerStageId" value={triggerStageId ?? ""} />
      <input type="hidden" name="channelId" value={channelId ?? ""} />
      <input type="hidden" name="messageTemplateId" value={messageTemplateId ?? ""} />

      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="nps-active">Envio automático ativo</Label>
          <p className="text-xs text-muted-foreground">
            Desligado = pesquisas não são enviadas, mesmo com gatilho configurado.
          </p>
        </div>
        <Switch id="nps-active" checked={active} onCheckedChange={setActive} />
      </div>

      <div className="space-y-3 border-t border-border pt-4">
        <p className="text-sm font-medium">Gatilhos (ao menos um)</p>
        <div className="flex items-center justify-between">
          <Label htmlFor="nps-won">Negócio marcado como Ganho</Label>
          <Switch id="nps-won" checked={triggerOnWon} onCheckedChange={setTriggerOnWon} />
        </div>
        <div className="space-y-2">
          <Label>Negócio entra na etapa</Label>
          <Select
            items={Object.fromEntries(stages.map((s) => [s.id, s.label]))}
            value={triggerStageId}
            onValueChange={(value) => setTriggerStageId(value ?? null)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Nenhuma (opcional)" />
            </SelectTrigger>
            <SelectContent>
              {stages.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2 border-t border-border pt-4">
        <Label htmlFor="nps-delay">Enviar depois de (dias)</Label>
        <Input
          id="nps-delay"
          name="delayDays"
          type="number"
          min={0}
          defaultValue={settings?.delayDays ?? 3}
          className="w-32"
        />
        <p className="text-xs text-muted-foreground">
          Contado a partir da entrada na etapa ou da marcação como ganho, o que disparar.
        </p>
      </div>

      <div className="space-y-2 border-t border-border pt-4">
        <Label>Canal de envio</Label>
        <Select
          items={Object.fromEntries(channels.map((c) => [c.id, c.label]))}
          value={channelId}
          onValueChange={(value) => setChannelId(value ?? null)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Selecione um canal" />
          </SelectTrigger>
          <SelectContent>
            {channels.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Template da mensagem</Label>
        <Select
          items={Object.fromEntries(templates.map((t) => [t.id, t.name]))}
          value={messageTemplateId}
          onValueChange={(value) => setMessageTemplateId(value ?? null)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Selecione um template" />
          </SelectTrigger>
          <SelectContent>
            {templates.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          O template precisa incluir <span className="font-mono">{"{{link_pesquisa}}"}</span> —
          onde entra o link da pesquisa.
        </p>
      </div>

      {state.status === "error" && <p className="text-sm text-destructive">{state.message}</p>}
      <Button type="submit" disabled={isSaving}>
        {isSaving ? "Salvando..." : "Salvar"}
      </Button>
    </form>
  );
}
