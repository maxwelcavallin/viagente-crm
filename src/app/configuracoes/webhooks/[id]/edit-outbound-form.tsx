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
import { updateOutboundWebhookAction, type WebhookFormState } from "../actions";

const idleState: WebhookFormState = { status: "idle" };

const EVENT_LABELS: Record<string, string> = {
  negocio_criado: "Negócio criado",
  etapa_alterada: "Etapa alterada",
  negocio_ganho: "Negócio ganho",
  negocio_perdido: "Negócio perdido",
};

export function EditOutboundForm({
  webhook,
  pipelines,
  stages,
}: {
  webhook: {
    id: string;
    name: string;
    targetUrl: string | null;
    events: string[];
    pipelineId: string | null;
    stageId: string | null;
  };
  pipelines: { id: string; name: string }[];
  stages: { id: string; name: string; pipelineId: string; order: number }[];
}) {
  const router = useRouter();
  const [pipelineId, setPipelineId] = useState<string | null>(webhook.pipelineId);
  const [stageId, setStageId] = useState<string | null>(webhook.stageId);
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(
    new Set(webhook.events)
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const stagesForPipeline = useMemo(
    () => stages.filter((s) => s.pipelineId === pipelineId).sort((a, b) => a.order - b.order),
    [stages, pipelineId]
  );

  function toggleEvent(event: string) {
    setSelectedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(event)) next.delete(event);
      else next.add(event);
      return next;
    });
  }

  async function handleSubmit(formData: FormData) {
    setIsPending(true);
    setError(null);
    const result = await updateOutboundWebhookAction(idleState, formData);
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
      <input type="hidden" name="pipelineId" value={pipelineId ?? ""} />
      <input type="hidden" name="stageId" value={stageId ?? ""} />
      <div className="space-y-2">
        <Label htmlFor="edit-out-name">Nome</Label>
        <Input id="edit-out-name" name="name" defaultValue={webhook.name} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="edit-out-url">URL de destino</Label>
        <Input
          id="edit-out-url"
          name="targetUrl"
          type="url"
          defaultValue={webhook.targetUrl ?? ""}
          required
        />
      </div>
      <div className="space-y-2">
        <Label>Eventos</Label>
        <div className="space-y-1.5">
          {Object.entries(EVENT_LABELS).map(([value, label]) => (
            <label key={value} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="events"
                value={value}
                checked={selectedEvents.has(value)}
                onChange={() => toggleEvent(value)}
                className="size-4 rounded border-input"
              />
              {label}
            </label>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Pipeline (opcional)</Label>
          <Select
            items={{ "": "Qualquer pipeline", ...Object.fromEntries(pipelines.map((p) => [p.id, p.name])) }}
            value={pipelineId ?? ""}
            onValueChange={(v) => {
              setPipelineId(v || null);
              setStageId(null);
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Qualquer pipeline" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Qualquer pipeline</SelectItem>
              {pipelines.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Etapa específica (opcional)</Label>
          <Select
            items={{ "": "Qualquer etapa", ...Object.fromEntries(stagesForPipeline.map((s) => [s.id, s.name])) }}
            value={stageId ?? ""}
            onValueChange={(v) => setStageId(v || null)}
          >
            <SelectTrigger className="w-full" disabled={!pipelineId}>
              <SelectValue placeholder="Qualquer etapa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Qualquer etapa</SelectItem>
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
