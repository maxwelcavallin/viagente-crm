"use client";

import { useActionState, useState } from "react";
import { ArrowDown, ArrowUp, ListOrdered, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
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
import { Switch } from "@/components/ui/switch";
import { DurationPicker, formatMinutesShort } from "@/components/duration-picker";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { FieldDef } from "@/lib/custom-fields";
import {
  createSequenceAction,
  deleteSequenceAction,
  updateSequenceAction,
  type SequenceFormState,
} from "./actions";

export type SequenceStepRow = {
  id: string;
  order: number;
  delayMinutes: number;
  type: "mensagem" | "tarefa_generica" | "tag" | "mudar_etapa";
  title: string | null;
  messageTemplateId: string | null;
  autoSend: boolean;
  autoSendChannelId: string | null;
  addTagId: string | null;
  moveToStageId: string | null;
};

export type SequenceCondition = {
  field: string;
  operator: "eq" | "gt" | "lt" | "contains";
  value: string;
} | null;

export type SequenceRow = {
  id: string;
  name: string;
  active: boolean;
  triggerType: "etapa" | "tag" | "sem_resposta" | "ganho" | "perdido";
  triggerStageId: string | null;
  triggerTagId: string | null;
  noResponseDays: number | null;
  conditions: SequenceCondition;
  steps: SequenceStepRow[];
};

type StageOption = { id: string; name: string; pipelineId: string; pipelineName: string };
type TagOption = { id: string; name: string };
type TemplateOption = { id: string; name: string };
type ChannelOption = { id: string; label: string };

const TRIGGER_LABELS: Record<SequenceRow["triggerType"], string> = {
  etapa: "Entrar na etapa",
  tag: "Ganhar a tag",
  sem_resposta: "Sem resposta há N dias",
  ganho: "Negócio ganho",
  perdido: "Negócio perdido",
};

const STEP_TYPE_LABELS: Record<SequenceStepRow["type"], string> = {
  mensagem: "Mensagem",
  tarefa_generica: "Tarefa genérica",
  tag: "Adicionar tag",
  mudar_etapa: "Mudar de etapa",
};

const OPERATOR_LABELS: Record<NonNullable<SequenceCondition>["operator"], string> = {
  eq: "é igual a",
  gt: "é maior que",
  lt: "é menor que",
  contains: "contém",
};

function newStepId(): string {
  return `new-${Math.random().toString(36).slice(2)}`;
}

function emptyStep(): SequenceStepRow {
  return {
    id: newStepId(),
    order: 0,
    delayMinutes: 0,
    type: "mensagem",
    title: null,
    messageTemplateId: null,
    autoSend: false,
    autoSendChannelId: null,
    addTagId: null,
    moveToStageId: null,
  };
}

function StepRowEditor({
  step,
  index,
  total,
  onChange,
  onRemove,
  onMove,
  stages,
  allTags,
  templates,
  channels,
}: {
  step: SequenceStepRow;
  index: number;
  total: number;
  onChange: (next: SequenceStepRow) => void;
  onRemove: () => void;
  onMove: (direction: "up" | "down") => void;
  stages: StageOption[];
  allTags: TagOption[];
  templates: TemplateOption[];
  channels: ChannelOption[];
}) {
  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Passo {index + 1}
        </span>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={index === 0}
            onClick={() => onMove("up")}
            aria-label="Mover passo pra cima"
          >
            <ArrowUp size={14} strokeWidth={1.75} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={index === total - 1}
            onClick={() => onMove("down")}
            aria-label="Mover passo pra baixo"
          >
            <ArrowDown size={14} strokeWidth={1.75} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onRemove}
            aria-label="Remover passo"
          >
            <Trash2 size={14} strokeWidth={1.75} />
          </Button>
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">
          {index === 0 ? "Espera desde o gatilho" : "Espera desde o passo anterior"}
        </Label>
        <DurationPicker
          idPrefix={`step-${step.id}-delay`}
          totalMinutes={step.delayMinutes}
          onChange={(delayMinutes) => onChange({ ...step, delayMinutes })}
          size="sm"
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Tipo</Label>
        <Select
          items={STEP_TYPE_LABELS}
          value={step.type}
          onValueChange={(v) =>
            onChange({ ...step, type: (v as SequenceStepRow["type"]) ?? "mensagem" })
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(STEP_TYPE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {step.type === "mensagem" && (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Template</Label>
            <Select
              items={Object.fromEntries(templates.map((t) => [t.id, t.name]))}
              value={step.messageTemplateId}
              onValueChange={(v) => onChange({ ...step, messageTemplateId: v ?? null })}
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
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Enviar sozinha, sem clique</Label>
            <Switch
              checked={step.autoSend}
              onCheckedChange={(autoSend) => onChange({ ...step, autoSend })}
            />
          </div>
          {step.autoSend ? (
            <div className="space-y-1">
              <Label className="text-xs">Canal WhatsApp</Label>
              <Select
                items={Object.fromEntries(channels.map((c) => [c.id, c.label]))}
                value={step.autoSendChannelId}
                onValueChange={(v) => onChange({ ...step, autoSendChannelId: v ?? null })}
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
          ) : (
            <div className="space-y-1">
              <Label className="text-xs">Título da tarefa (fica pendente pra enviar manualmente)</Label>
              <Input
                value={step.title ?? ""}
                onChange={(e) => onChange({ ...step, title: e.target.value })}
              />
            </div>
          )}
        </div>
      )}

      {step.type === "tarefa_generica" && (
        <div className="space-y-1">
          <Label className="text-xs">Título da tarefa</Label>
          <Input
            value={step.title ?? ""}
            onChange={(e) => onChange({ ...step, title: e.target.value })}
          />
        </div>
      )}

      {step.type === "tag" && (
        <div className="space-y-1">
          <Label className="text-xs">Tag a adicionar</Label>
          <Select
            items={Object.fromEntries(allTags.map((t) => [t.id, t.name]))}
            value={step.addTagId}
            onValueChange={(v) => onChange({ ...step, addTagId: v ?? null })}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione uma tag" />
            </SelectTrigger>
            <SelectContent>
              {allTags.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {step.type === "mudar_etapa" && (
        <div className="space-y-1">
          <Label className="text-xs">Etapa de destino</Label>
          <Select
            items={Object.fromEntries(stages.map((s) => [s.id, `${s.pipelineName} > ${s.name}`]))}
            value={step.moveToStageId}
            onValueChange={(v) => onChange({ ...step, moveToStageId: v ?? null })}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione uma etapa" />
            </SelectTrigger>
            <SelectContent>
              {stages.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.pipelineName} &gt; {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}

const CONDITION_FIELD_TEMPERATURE = "temperature";
const CONDITION_FIELD_TAGS = "tags";

function SequenceFormDialog({
  sequence,
  stages,
  allTags,
  templates,
  channels,
  dealFieldDefinitions,
  trigger,
}: {
  sequence?: SequenceRow;
  stages: StageOption[];
  allTags: TagOption[];
  templates: TemplateOption[];
  channels: ChannelOption[];
  dealFieldDefinitions: FieldDef[];
  trigger: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(sequence?.name ?? "");
  const [active, setActive] = useState(sequence?.active ?? true);
  const [triggerType, setTriggerType] = useState<SequenceRow["triggerType"]>(
    sequence?.triggerType ?? "etapa"
  );
  const [triggerStageId, setTriggerStageId] = useState<string | null>(
    sequence?.triggerStageId ?? stages[0]?.id ?? null
  );
  const [triggerTagId, setTriggerTagId] = useState<string | null>(
    sequence?.triggerTagId ?? allTags[0]?.id ?? null
  );
  const [noResponseDays, setNoResponseDays] = useState(sequence?.noResponseDays ?? 5);
  const [hasCondition, setHasCondition] = useState(sequence?.conditions != null);
  const [conditionField, setConditionField] = useState(
    sequence?.conditions?.field ?? CONDITION_FIELD_TEMPERATURE
  );
  const [conditionOperator, setConditionOperator] = useState<NonNullable<SequenceCondition>["operator"]>(
    sequence?.conditions?.operator ?? "eq"
  );
  const [conditionValue, setConditionValue] = useState(sequence?.conditions?.value ?? "");
  const [steps, setSteps] = useState<SequenceStepRow[]>(
    sequence?.steps && sequence.steps.length > 0 ? sequence.steps : [emptyStep()]
  );

  const action = sequence ? updateSequenceAction : createSequenceAction;
  const idleState: SequenceFormState = { status: "idle" };
  const [state, formAction, isPending] = useActionState(action, idleState);

  const conditionFieldOptions: Record<string, string> = {
    [CONDITION_FIELD_TEMPERATURE]: "Temperatura",
    [CONDITION_FIELD_TAGS]: "Tags",
    ...Object.fromEntries(dealFieldDefinitions.map((f) => [f.key, f.label])),
  };

  function updateStep(index: number, next: SequenceStepRow) {
    setSteps((prev) => prev.map((s, i) => (i === index ? next : s)));
  }

  function removeStep(index: number) {
    setSteps((prev) => prev.filter((_, i) => i !== index));
  }

  function moveStep(index: number, direction: "up" | "down") {
    setSteps((prev) => {
      const next = [...prev];
      const swapWith = direction === "up" ? index - 1 : index + 1;
      if (swapWith < 0 || swapWith >= next.length) return prev;
      [next[index], next[swapWith]] = [next[swapWith], next[index]];
      return next;
    });
  }

  const conditionsPayload = hasCondition
    ? JSON.stringify({ field: conditionField, operator: conditionOperator, value: conditionValue })
    : "";

  const stepsPayload = JSON.stringify(
    steps.map((s) => ({
      delayMinutes: s.delayMinutes,
      type: s.type,
      title: s.title,
      messageTemplateId: s.messageTemplateId,
      autoSend: s.autoSend,
      autoSendChannelId: s.autoSendChannelId,
      addTagId: s.addTagId,
      moveToStageId: s.moveToStageId,
    }))
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{sequence ? "Editar sequência" : "Nova sequência"}</DialogTitle>
          <DialogDescription>
            Uma sequência dispara na etapa/tag/falta de resposta escolhida e executa os passos, um
            a um, respeitando o intervalo configurado.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          {sequence && <input type="hidden" name="id" value={sequence.id} />}
          <input type="hidden" name="active" value={String(active)} />
          <input type="hidden" name="triggerType" value={triggerType} />
          <input type="hidden" name="triggerStageId" value={triggerStageId ?? ""} />
          <input type="hidden" name="triggerTagId" value={triggerTagId ?? ""} />
          <input type="hidden" name="noResponseDays" value={noResponseDays || ""} />
          <input type="hidden" name="conditions" value={conditionsPayload} />
          <input type="hidden" name="steps" value={stepsPayload} />

          <div className="space-y-2">
            <Label htmlFor="seq-name">Nome</Label>
            <Input
              id="seq-name"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="seq-active">Ativa</Label>
            <Switch id="seq-active" checked={active} onCheckedChange={setActive} />
          </div>

          <div className="space-y-2">
            <Label>Gatilho</Label>
            <Select
              items={TRIGGER_LABELS}
              value={triggerType}
              onValueChange={(v) =>
                setTriggerType((v as SequenceRow["triggerType"]) ?? "etapa")
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TRIGGER_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {triggerType === "etapa" && (
            <div className="space-y-2">
              <Label>Etapa</Label>
              <Select
                items={Object.fromEntries(stages.map((s) => [s.id, `${s.pipelineName} > ${s.name}`]))}
                value={triggerStageId}
                onValueChange={(v) => setTriggerStageId(v ?? null)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione uma etapa" />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.pipelineName} &gt; {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {triggerType === "tag" && (
            <div className="space-y-2">
              <Label>Tag</Label>
              <Select
                items={Object.fromEntries(allTags.map((t) => [t.id, t.name]))}
                value={triggerTagId}
                onValueChange={(v) => setTriggerTagId(v ?? null)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione uma tag" />
                </SelectTrigger>
                <SelectContent>
                  {allTags.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {triggerType === "sem_resposta" && (
            <div className="space-y-2">
              <Label htmlFor="seq-no-response-days">Dias sem resposta do contato</Label>
              <Input
                id="seq-no-response-days"
                type="number"
                min={1}
                className="w-24"
                value={noResponseDays}
                onChange={(e) => setNoResponseDays(Number(e.target.value) || 0)}
              />
            </div>
          )}

          <div className="space-y-3 border-t border-border pt-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="seq-has-condition">Só iniciar se uma condição bater</Label>
              <Switch id="seq-has-condition" checked={hasCondition} onCheckedChange={setHasCondition} />
            </div>
            {hasCondition && (
              <div className="grid grid-cols-3 gap-2">
                <Select
                  items={conditionFieldOptions}
                  value={conditionField}
                  onValueChange={(v) => setConditionField(v ?? CONDITION_FIELD_TEMPERATURE)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(conditionFieldOptions).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  items={OPERATOR_LABELS}
                  value={conditionOperator}
                  onValueChange={(v) =>
                    setConditionOperator((v as NonNullable<SequenceCondition>["operator"]) ?? "eq")
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(OPERATOR_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={conditionValue}
                  onChange={(e) => setConditionValue(e.target.value)}
                  placeholder="Valor"
                />
              </div>
            )}
          </div>

          <div className="space-y-3 border-t border-border pt-4">
            <div className="flex items-center justify-between">
              <Label>Passos</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSteps((prev) => [...prev, emptyStep()])}
              >
                <Plus size={14} strokeWidth={1.75} /> Adicionar passo
              </Button>
            </div>
            <div className="space-y-3">
              {steps.map((step, index) => (
                <StepRowEditor
                  key={step.id}
                  step={step}
                  index={index}
                  total={steps.length}
                  onChange={(next) => updateStep(index, next)}
                  onRemove={() => removeStep(index)}
                  onMove={(direction) => moveStep(index, direction)}
                  stages={stages}
                  allTags={allTags}
                  templates={templates}
                  channels={channels}
                />
              ))}
            </div>
          </div>

          {state.status === "error" && (
            <p className="text-sm text-destructive">{state.message}</p>
          )}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancelar
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteSequenceDialog({ sequence }: { sequence: SequenceRow }) {
  const idleState: SequenceFormState = { status: "idle" };
  const [state, formAction, isPending] = useActionState(deleteSequenceAction, idleState);

  return (
    <Dialog>
      <DialogTrigger render={<Button type="button" variant="destructive" size="sm" />}>
        Excluir
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir a sequência &quot;{sequence.name}&quot;?</DialogTitle>
          <DialogDescription>
            Execuções em andamento dessa sequência param imediatamente. Essa ação não pode ser
            desfeita.
          </DialogDescription>
        </DialogHeader>
        {state.status === "error" && (
          <p className="text-sm text-destructive">{state.message}</p>
        )}
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>
            Cancelar
          </DialogClose>
          <form action={formAction}>
            <input type="hidden" name="id" value={sequence.id} />
            <Button type="submit" variant="destructive" disabled={isPending}>
              {isPending ? "Excluindo..." : "Confirmar exclusão"}
            </Button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SequencesList({
  sequences,
  stages,
  allTags,
  templates,
  channels,
  dealFieldDefinitions,
}: {
  sequences: SequenceRow[];
  stages: StageOption[];
  allTags: TagOption[];
  templates: TemplateOption[];
  channels: ChannelOption[];
  dealFieldDefinitions: FieldDef[];
}) {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <SequenceFormDialog
          stages={stages}
          allTags={allTags}
          templates={templates}
          channels={channels}
          dealFieldDefinitions={dealFieldDefinitions}
          trigger={<Button type="button">Nova sequência</Button>}
        />
      </div>
      {sequences.length === 0 ? (
        <EmptyState
          icon={ListOrdered}
          title="Nenhuma sequência configurada"
          description="Crie uma pelo botão acima."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Gatilho</TableHead>
              <TableHead>Passos</TableHead>
              <TableHead>Ativa</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sequences.map((seq) => (
              <TableRow key={seq.id}>
                <TableCell className="font-medium">{seq.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {TRIGGER_LABELS[seq.triggerType]}
                  {seq.triggerType === "sem_resposta" && seq.noResponseDays != null
                    ? ` (${seq.noResponseDays}d)`
                    : ""}
                  {seq.conditions && (
                    <Badge variant="secondary" className="ml-1.5">
                      com condição
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  {seq.steps.length} passo{seq.steps.length === 1 ? "" : "s"}
                  {seq.steps.length > 0 && (
                    <span className="ml-1.5 text-muted-foreground">
                      ({formatMinutesShort(seq.steps.reduce((sum, s) => sum + s.delayMinutes, 0))} total)
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  {seq.active ? (
                    <Badge variant="success">Sim</Badge>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <SequenceFormDialog
                      sequence={seq}
                      stages={stages}
                      allTags={allTags}
                      templates={templates}
                      channels={channels}
                      dealFieldDefinitions={dealFieldDefinitions}
                      trigger={
                        <Button type="button" variant="outline" size="sm">
                          Editar
                        </Button>
                      }
                    />
                    <DeleteSequenceDialog sequence={seq} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
