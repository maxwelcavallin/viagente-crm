"use client";

import { useActionState, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { saveAutoDealSettingsAction, type SaveAutoDealSettingsState } from "./actions";

const idleState: SaveAutoDealSettingsState = { status: "idle" };

export function AutoDealSettingsForm({
  settings,
  pipelines,
  stages,
}: {
  settings: { active: boolean; pipelineId: string | null; stageId: string | null } | null;
  pipelines: { id: string; name: string }[];
  stages: { id: string; name: string; pipelineId: string; order: number }[];
}) {
  const [state, formAction, isSaving] = useActionState(saveAutoDealSettingsAction, idleState);
  const [active, setActive] = useState(settings?.active ?? false);
  const [pipelineId, setPipelineId] = useState<string | null>(settings?.pipelineId ?? null);
  const [stageId, setStageId] = useState<string | null>(settings?.stageId ?? null);

  const stagesForPipeline = useMemo(
    () =>
      stages.filter((s) => s.pipelineId === pipelineId).sort((a, b) => a.order - b.order),
    [stages, pipelineId]
  );

  function handlePipelineChange(nextPipelineId: string | null) {
    setPipelineId(nextPipelineId);
    const firstStage = stages
      .filter((s) => s.pipelineId === nextPipelineId)
      .sort((a, b) => a.order - b.order)[0];
    setStageId(firstStage?.id ?? null);
  }

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="active" value={active ? "on" : ""} />
      <input type="hidden" name="pipelineId" value={pipelineId ?? ""} />
      <input type="hidden" name="stageId" value={stageId ?? ""} />

      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="auto-deal-active">Criação automática ativa</Label>
          <p className="text-xs text-muted-foreground">
            Desligado = novas conversas do WhatsApp não criam negócio automaticamente.
          </p>
        </div>
        <Switch id="auto-deal-active" checked={active} onCheckedChange={setActive} />
      </div>

      <div className="grid grid-cols-2 gap-3 border-t border-border pt-4">
        <div className="space-y-2">
          <Label>Pipeline</Label>
          <Select
            items={Object.fromEntries(pipelines.map((p) => [p.id, p.name]))}
            value={pipelineId}
            onValueChange={handlePipelineChange}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione a pipeline" />
            </SelectTrigger>
            <SelectContent>
              {pipelines.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Etapa</Label>
          <Select
            items={Object.fromEntries(stagesForPipeline.map((s) => [s.id, s.name]))}
            value={stageId}
            onValueChange={(value) => setStageId(value ?? null)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione a etapa" />
            </SelectTrigger>
            <SelectContent>
              {stagesForPipeline.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Dispara quando chega a primeira mensagem de um contato (individual, não grupo) que ainda
        não tem nenhum negócio aberto — em qualquer canal conectado (WhatsApp ou Instagram).
      </p>

      {state.status === "error" && <p className="text-sm text-destructive">{state.message}</p>}
      <Button type="submit" disabled={isSaving}>
        {isSaving ? "Salvando..." : "Salvar"}
      </Button>
    </form>
  );
}
