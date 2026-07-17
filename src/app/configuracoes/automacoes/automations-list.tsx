"use client";

import { useActionState, useState } from "react";
import { Zap } from "lucide-react";
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
import {
  createTagAutomationAction,
  deleteTagAutomationAction,
  updateTagAutomationAction,
  type TagAutomationFormState,
} from "./actions";

export type TagAutomationRow = {
  id: string;
  tagId: string;
  tagName: string;
  tagColor: string | null;
  trigger: "tag_adicionada" | "dias_apos_tag";
  delayMinutes: number | null;
  title: string;
  type: "mensagem" | "ligacao" | "agendamento" | "generica" | "email";
  messageTemplateId: string | null;
  autoSend: boolean;
  autoSendChannelId: string | null;
};

const TYPE_LABELS: Record<TagAutomationRow["type"], string> = {
  mensagem: "Mensagem",
  ligacao: "Ligação",
  agendamento: "Agendamento",
  generica: "Genérica",
  email: "Email",
};

const TRIGGER_LABELS: Record<TagAutomationRow["trigger"], string> = {
  tag_adicionada: "Tag adicionada",
  dias_apos_tag: "X dias com a tag",
};

const idleState: TagAutomationFormState = { status: "idle" };

function TagAutomationFormDialog({
  automation,
  allTags,
  templates,
  channels,
  trigger,
}: {
  automation?: TagAutomationRow;
  allTags: { id: string; name: string; color: string | null }[];
  templates: { id: string; name: string }[];
  channels: { id: string; label: string }[];
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [tagId, setTagId] = useState<string | null>(automation?.tagId ?? allTags[0]?.id ?? null);
  const [type, setType] = useState<TagAutomationRow["type"]>(automation?.type ?? "mensagem");
  const [ruleTrigger, setRuleTrigger] = useState<TagAutomationRow["trigger"]>(
    automation?.trigger ?? "tag_adicionada"
  );
  const [delayMinutes, setDelayMinutes] = useState(automation?.delayMinutes ?? 0);
  const [messageTemplateId, setMessageTemplateId] = useState<string | null>(
    automation?.messageTemplateId ?? null
  );
  const [autoSend, setAutoSend] = useState(automation?.autoSend ?? false);
  const [autoSendChannelId, setAutoSendChannelId] = useState<string | null>(
    automation?.autoSendChannelId ?? null
  );
  const action = automation ? updateTagAutomationAction : createTagAutomationAction;
  const [state, formAction, isPending] = useActionState(action, idleState);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{automation ? "Editar automação" : "Nova automação por tag"}</DialogTitle>
          <DialogDescription>
            Dispara uma tarefa (e, se configurado, envia a mensagem sozinha) quando a tag
            escolhida é adicionada a um negócio.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          {automation && <input type="hidden" name="id" value={automation.id} />}
          <input type="hidden" name="tagId" value={tagId ?? ""} />
          <input type="hidden" name="type" value={type} />
          <input type="hidden" name="trigger" value={ruleTrigger} />
          <input type="hidden" name="messageTemplateId" value={messageTemplateId ?? ""} />
          <input type="hidden" name="autoSend" value={String(autoSend)} />
          <input type="hidden" name="autoSendChannelId" value={autoSendChannelId ?? ""} />

          <div className="space-y-2">
            <Label>Tag</Label>
            <Select
              items={Object.fromEntries(allTags.map((t) => [t.id, t.name]))}
              value={tagId}
              onValueChange={setTagId}
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

          <div className="space-y-2">
            <Label htmlFor="ta-title">Título da tarefa</Label>
            <Input id="ta-title" name="title" defaultValue={automation?.title} required />
          </div>

          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select
              items={TYPE_LABELS}
              value={type}
              onValueChange={(v) => setType((v as TagAutomationRow["type"]) ?? "mensagem")}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {type === "mensagem" && (
            <div className="space-y-2">
              <Label>Template</Label>
              <Select
                items={Object.fromEntries(templates.map((t) => [t.id, t.name]))}
                value={messageTemplateId}
                onValueChange={(v) => setMessageTemplateId(v ?? null)}
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
          )}

          <div className="space-y-2">
            <Label>Gatilho</Label>
            <Select
              items={TRIGGER_LABELS}
              value={ruleTrigger}
              onValueChange={(v) =>
                setRuleTrigger((v as TagAutomationRow["trigger"]) ?? "tag_adicionada")
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

          {ruleTrigger === "dias_apos_tag" && (
            <div className="space-y-2">
              <Label>Tempo com a tag antes de disparar</Label>
              <input type="hidden" name="delayMinutes" value={delayMinutes || ""} />
              <DurationPicker
                idPrefix="ta-delay"
                totalMinutes={delayMinutes}
                onChange={setDelayMinutes}
              />
            </div>
          )}

          {type === "mensagem" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="ta-autosend">Enviar automaticamente, sem clique</Label>
                  <p className="text-xs text-muted-foreground">
                    A mensagem sai sozinha assim que a tarefa é criada.
                  </p>
                </div>
                <Switch id="ta-autosend" checked={autoSend} onCheckedChange={setAutoSend} />
              </div>
              {autoSend && (
                <div className="space-y-2">
                  <Label>Canal WhatsApp</Label>
                  <Select
                    items={Object.fromEntries(channels.map((c) => [c.id, c.label]))}
                    value={autoSendChannelId}
                    onValueChange={(v) => setAutoSendChannelId(v ?? null)}
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
              )}
            </div>
          )}

          {state.status === "error" && (
            <p className="text-sm text-destructive">{state.message}</p>
          )}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancelar
            </DialogClose>
            <Button type="submit" disabled={isPending || !tagId}>
              {isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteAutomationDialog({ automation }: { automation: TagAutomationRow }) {
  const [state, formAction, isPending] = useActionState(
    deleteTagAutomationAction,
    idleState
  );

  return (
    <Dialog>
      <DialogTrigger render={<Button type="button" variant="destructive" size="sm" />}>
        Excluir
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir a automação &quot;{automation.title}&quot;?</DialogTitle>
          <DialogDescription>Essa ação não pode ser desfeita.</DialogDescription>
        </DialogHeader>
        {state.status === "error" && (
          <p className="text-sm text-destructive">{state.message}</p>
        )}
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>
            Cancelar
          </DialogClose>
          <form action={formAction}>
            <input type="hidden" name="id" value={automation.id} />
            <Button type="submit" variant="destructive" disabled={isPending}>
              {isPending ? "Excluindo..." : "Confirmar exclusão"}
            </Button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AutomationsList({
  automations,
  allTags,
  templates,
  channels,
}: {
  automations: TagAutomationRow[];
  allTags: { id: string; name: string; color: string | null }[];
  templates: { id: string; name: string }[];
  channels: { id: string; label: string }[];
}) {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <TagAutomationFormDialog
          allTags={allTags}
          templates={templates}
          channels={channels}
          trigger={<Button type="button">Nova automação</Button>}
        />
      </div>
      {automations.length === 0 ? (
        <EmptyState
          icon={Zap}
          title="Nenhuma automação por tag configurada"
          description="Crie uma pelo botão acima."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tag</TableHead>
              <TableHead>Gatilho</TableHead>
              <TableHead>Tarefa</TableHead>
              <TableHead>Envio automático</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {automations.map((automation) => (
              <TableRow key={automation.id}>
                <TableCell>
                  <span className="inline-flex items-center gap-1.5 text-sm">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: automation.tagColor ?? "currentColor" }}
                    />
                    {automation.tagName}
                  </span>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {TRIGGER_LABELS[automation.trigger]}
                  {automation.trigger === "dias_apos_tag" && automation.delayMinutes != null
                    ? ` (${formatMinutesShort(automation.delayMinutes)})`
                    : ""}
                </TableCell>
                <TableCell className="text-sm">
                  {automation.title}{" "}
                  <Badge variant="secondary">{TYPE_LABELS[automation.type]}</Badge>
                </TableCell>
                <TableCell>
                  {automation.autoSend ? (
                    <Badge variant="success">Sim</Badge>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <TagAutomationFormDialog
                      automation={automation}
                      allTags={allTags}
                      templates={templates}
                      channels={channels}
                      trigger={
                        <Button type="button" variant="outline" size="sm">
                          Editar
                        </Button>
                      }
                    />
                    <DeleteAutomationDialog automation={automation} />
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
