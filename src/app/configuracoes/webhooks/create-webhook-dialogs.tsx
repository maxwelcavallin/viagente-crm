"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createInboundWebhookAction,
  createOutboundWebhookAction,
  type WebhookFormState,
} from "./actions";

const idleState: WebhookFormState = { status: "idle" };

type PipelineOption = { id: string; name: string };
type StageOption = { id: string; name: string; pipelineId: string; order: number };

const EVENT_LABELS: Record<string, string> = {
  negocio_criado: "Negócio criado",
  etapa_alterada: "Etapa alterada",
  negocio_ganho: "Negócio ganho",
  negocio_perdido: "Negócio perdido",
};

function CreateInboundDialog({
  pipelines,
  stages,
}: {
  pipelines: PipelineOption[];
  stages: StageOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pipelineId, setPipelineId] = useState<string | null>(
    pipelines[0]?.id ?? null
  );
  const [stageId, setStageId] = useState<string | null>(
    stages.find((s) => s.pipelineId === pipelines[0]?.id)?.id ?? null
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [createdSecret, setCreatedSecret] = useState<{
    id: string;
    token: string;
  } | null>(null);

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
    const result = await createInboundWebhookAction(idleState, formData);
    setIsPending(false);
    if (result.status === "error") {
      setError(result.message);
      return;
    }
    if (result.status === "success" && result.secretToken) {
      setCreatedSecret({ id: result.webhookId, token: result.secretToken });
    }
  }

  function handleClose() {
    setOpen(false);
    if (createdSecret) router.refresh();
    setCreatedSecret(null);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : handleClose())}>
      <DialogTrigger render={<Button type="button" variant="outline" />}>
        <Plus size={16} strokeWidth={1.75} />
        Webhook de entrada
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        {createdSecret ? (
          <>
            <DialogHeader>
              <DialogTitle>Webhook criado</DialogTitle>
              <DialogDescription>
                Copie o token agora — ele não será mostrado de novo.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 rounded-lg border-l-[3px] border-status-warning bg-status-warning/10 p-4 text-sm">
              <p className="flex items-start gap-2 font-medium">
                <TriangleAlert size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-status-warning" />
                <span>Guarde o token e a URL — configure isso na plataforma de origem.</span>
              </p>
              <div className="space-y-1">
                <p>
                  <span className="text-muted-foreground">URL:</span>{" "}
                  <code className="rounded bg-background px-2 py-1 font-mono text-xs break-all">
                    /api/webhooks/inbound/{createdSecret.id}
                  </code>
                </p>
                <p className="flex flex-wrap items-center gap-2">
                  <span className="text-muted-foreground">Token:</span>
                  <code className="rounded bg-background px-2 py-1 font-mono text-xs break-all">
                    {createdSecret.token}
                  </code>
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" onClick={handleClose}>
                Fechar
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Novo webhook de entrada</DialogTitle>
              <DialogDescription>
                Recebe payloads externos (ex: Calculadora, Diagnóstico) e cria
                contato/negócio na pipeline/etapa padrão.
              </DialogDescription>
            </DialogHeader>
            <form action={handleSubmit} className="space-y-4">
              <input type="hidden" name="defaultPipelineId" value={pipelineId ?? ""} />
              <input type="hidden" name="defaultStageId" value={stageId ?? ""} />
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <Input id="name" name="name" placeholder="Ex: Calculadora" required />
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
              <DialogFooter>
                <DialogClose render={<Button type="button" variant="outline" />}>
                  Cancelar
                </DialogClose>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Criando..." : "Criar webhook"}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CreateOutboundDialog({
  pipelines,
  stages,
}: {
  pipelines: PipelineOption[];
  stages: StageOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pipelineId, setPipelineId] = useState<string | null>(null);
  const [stageId, setStageId] = useState<string | null>(null);
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set());
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
    const result = await createOutboundWebhookAction(idleState, formData);
    setIsPending(false);
    if (result.status === "error") {
      setError(result.message);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" />}>
        <Plus size={16} strokeWidth={1.75} />
        Webhook de saída
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo webhook de saída</DialogTitle>
          <DialogDescription>
            Dispara um POST pra uma URL quando os eventos selecionados
            acontecerem no CRM.
          </DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <input type="hidden" name="pipelineId" value={pipelineId ?? ""} />
          <input type="hidden" name="stageId" value={stageId ?? ""} />
          <div className="space-y-2">
            <Label htmlFor="out-name">Nome</Label>
            <Input id="out-name" name="name" placeholder="Ex: Zapier - Proposta enviada" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="out-url">URL de destino</Label>
            <Input id="out-url" name="targetUrl" type="url" placeholder="https://..." required />
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
          <p className="text-xs text-muted-foreground">
            Etapa específica só se aplica ao evento &quot;Etapa alterada&quot;
            — os demais eventos ignoram esse filtro.
          </p>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancelar
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Criando..." : "Criar webhook"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CreateWebhookDialogs({
  pipelines,
  stages,
}: {
  pipelines: PipelineOption[];
  stages: StageOption[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <CreateInboundDialog pipelines={pipelines} stages={stages} />
      <CreateOutboundDialog pipelines={pipelines} stages={stages} />
    </div>
  );
}
