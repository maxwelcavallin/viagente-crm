"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
import { updateInboundWebhookAction, type WebhookFormState } from "../actions";

const idleState: WebhookFormState = { status: "idle" };

export function EditInboundForm({
  webhook,
  pipelines,
  stages,
}: {
  webhook: {
    id: string;
    name: string;
    defaultPipelineId: string | null;
    defaultStageId: string | null;
  };
  pipelines: { id: string; name: string }[];
  stages: { id: string; name: string; pipelineId: string; order: number }[];
}) {
  const router = useRouter();
  const [pipelineId, setPipelineId] = useState<string | null>(
    webhook.defaultPipelineId
  );
  const [stageId, setStageId] = useState<string | null>(webhook.defaultStageId);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const stagesForPipeline = useMemo(
    () => stages.filter((s) => s.pipelineId === pipelineId).sort((a, b) => a.order - b.order),
    [stages, pipelineId]
  );

  function handlePipelineChange(next: string | null) {
    setPipelineId(next);
    const firstStage = stages.find((s) => s.pipelineId === next);
    setStageId(firstStage?.id ?? null);
  }

  async function handleSubmit(formData: FormData) {
    setIsPending(true);
    setError(null);
    const result = await updateInboundWebhookAction(idleState, formData);
    setIsPending(false);
    if (result.status === "error") {
      setError(result.message);
      return;
    }
    router.refresh();
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <input type="hidden" name="id" value={webhook.id} />
      <input type="hidden" name="defaultPipelineId" value={pipelineId ?? ""} />
      <input type="hidden" name="defaultStageId" value={stageId ?? ""} />
      <div className="space-y-2">
        <Label htmlFor="edit-in-name">Nome</Label>
        <Input id="edit-in-name" name="name" defaultValue={webhook.name} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Pipeline padrão</Label>
          <Select
            items={Object.fromEntries(pipelines.map((p) => [p.id, p.name]))}
            value={pipelineId}
            onValueChange={handlePipelineChange}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Pipeline" />
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
          <Label>Etapa padrão</Label>
          <Select
            items={Object.fromEntries(stagesForPipeline.map((s) => [s.id, s.name]))}
            value={stageId}
            onValueChange={(v) => setStageId(v ?? null)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Etapa" />
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
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={isPending}>
        {isPending ? "Salvando..." : "Salvar"}
      </Button>
    </form>
  );
}
