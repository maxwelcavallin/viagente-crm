"use client";

import { useActionState, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Plus, Thermometer, Trash2 } from "lucide-react";
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
import {
  createTemperatureRuleAction,
  deleteTemperatureRuleAction,
  reorderTemperatureRulesAction,
  updateTemperatureRuleAction,
  type TemperatureRuleFormState,
} from "./actions";

type ConditionItem = { field: string; op: string; value: string };
type ConditionInput =
  | { all: ConditionItem[] }
  | { any: ConditionItem[] }
  | { default: true };

export type TemperatureRuleRow = {
  id: string;
  name: string;
  conditions: ConditionInput;
  result: "quente" | "morno" | "frio";
  priority: number;
};

type DealFieldOption = { key: string; label: string };

const RESULT_LABELS: Record<TemperatureRuleRow["result"], string> = {
  quente: "Quente",
  morno: "Morno",
  frio: "Frio",
};

const RESULT_BADGE_CLASS: Record<TemperatureRuleRow["result"], string> = {
  quente: "bg-status-error/15 text-status-error border-status-error/30",
  morno: "bg-status-warning/15 text-status-warning border-status-warning/30",
  frio: "bg-status-info/15 text-status-info border-status-info/30",
};

const OP_LABELS: Record<string, string> = {
  "=": "é igual a",
  "!=": "é diferente de",
  ">": "é maior que",
  ">=": "é maior ou igual a",
  "<": "é menor que",
  "<=": "é menor ou igual a",
};

type MatchType = "all" | "any" | "default";

function conditionsToForm(conditions: ConditionInput): { matchType: MatchType; items: ConditionItem[] } {
  if ("default" in conditions) return { matchType: "default", items: [] };
  if ("all" in conditions) return { matchType: "all", items: conditions.all };
  return { matchType: "any", items: conditions.any };
}

function summarizeConditions(conditions: ConditionInput, dealFields: DealFieldOption[]): string {
  const labelOf = (key: string) => dealFields.find((f) => f.key === key)?.label ?? key;
  if ("default" in conditions) return "Regra padrão — sempre bate se nenhuma anterior bateu";
  const { all, any } = conditions as { all?: ConditionItem[]; any?: ConditionItem[] };
  const items = all ?? any ?? [];
  const joiner = all ? " e " : " ou ";
  return items
    .map((c) => `${labelOf(c.field)} ${OP_LABELS[c.op] ?? c.op} "${c.value}"`)
    .join(joiner);
}

function ConditionRowEditor({
  item,
  dealFields,
  onChange,
  onRemove,
}: {
  item: ConditionItem;
  dealFields: DealFieldOption[];
  onChange: (item: ConditionItem) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-2">
      <Select
        items={Object.fromEntries(dealFields.map((f) => [f.key, f.label]))}
        value={item.field || null}
        onValueChange={(v) => onChange({ ...item, field: v ?? "" })}
      >
        <SelectTrigger className="w-48">
          <SelectValue placeholder="Campo do negócio" />
        </SelectTrigger>
        <SelectContent>
          {dealFields.map((f) => (
            <SelectItem key={f.key} value={f.key}>
              {f.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        items={OP_LABELS}
        value={item.op}
        onValueChange={(v) => onChange({ ...item, op: v ?? "=" })}
      >
        <SelectTrigger className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(OP_LABELS).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        value={item.value}
        onChange={(e) => onChange({ ...item, value: e.target.value })}
        placeholder="Valor"
        className="w-40"
      />
      <Button type="button" variant="ghost" size="icon" onClick={onRemove} title="Remover condição">
        <Trash2 size={16} strokeWidth={1.75} />
      </Button>
    </div>
  );
}

function RuleFormDialog({
  rule,
  dealFields,
  trigger,
}: {
  rule?: TemperatureRuleRow;
  dealFields: DealFieldOption[];
  trigger: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(rule?.name ?? "");
  const [result, setResult] = useState<TemperatureRuleRow["result"]>(rule?.result ?? "morno");
  const initialForm = rule ? conditionsToForm(rule.conditions) : { matchType: "all" as MatchType, items: [] };
  const [matchType, setMatchType] = useState<MatchType>(initialForm.matchType);
  const [items, setItems] = useState<ConditionItem[]>(
    initialForm.items.length > 0 ? initialForm.items : [{ field: dealFields[0]?.key ?? "", op: "=", value: "" }]
  );

  const action = rule ? updateTemperatureRuleAction : createTemperatureRuleAction;
  const idleState: TemperatureRuleFormState = { status: "idle" };
  const [state, formAction, isPending] = useActionState(action, idleState);

  const conditionsPayload =
    matchType === "default"
      ? JSON.stringify({ default: true })
      : JSON.stringify({ [matchType]: items });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{rule ? "Editar regra" : "Nova regra de temperatura"}</DialogTitle>
          <DialogDescription>
            Avaliada contra os campos customizados do negócio (os mesmos mapeados no webhook de
            entrada). A primeira regra que bater, na ordem da lista, define a temperatura.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          {rule && <input type="hidden" name="id" value={rule.id} />}
          <input type="hidden" name="conditions" value={conditionsPayload} />

          <div className="space-y-2">
            <Label htmlFor="rule-name">Nome</Label>
            <Input
              id="rule-name"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex: Quente — Calculadora de milhas"
            />
          </div>

          <div className="space-y-2">
            <Label>Temperatura resultante</Label>
            <input type="hidden" name="result" value={result} />
            <Select
              items={RESULT_LABELS}
              value={result}
              onValueChange={(v) => setResult((v as TemperatureRuleRow["result"]) ?? "morno")}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(RESULT_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Quando disparar</Label>
            <Select
              items={{
                all: "Todas as condições precisam bater",
                any: "Qualquer uma das condições basta",
                default: "Padrão — sempre bate (deixe por último na lista)",
              }}
              value={matchType}
              onValueChange={(v) => setMatchType((v as MatchType) ?? "all")}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as condições precisam bater</SelectItem>
                <SelectItem value="any">Qualquer uma das condições basta</SelectItem>
                <SelectItem value="default">Padrão — sempre bate (deixe por último na lista)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {matchType !== "default" && (
            <div className="space-y-2">
              {items.map((item, index) => (
                <ConditionRowEditor
                  key={index}
                  item={item}
                  dealFields={dealFields}
                  onChange={(next) => setItems((prev) => prev.map((it, i) => (i === index ? next : it)))}
                  onRemove={() => setItems((prev) => prev.filter((_, i) => i !== index))}
                />
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setItems((prev) => [...prev, { field: dealFields[0]?.key ?? "", op: "=", value: "" }])
                }
              >
                <Plus size={14} strokeWidth={1.75} />
                Adicionar condição
              </Button>
            </div>
          )}

          {state.status === "error" && <p className="text-sm text-destructive">{state.message}</p>}

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancelar</DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteRuleButton({ ruleId }: { ruleId: string }) {
  const idleState: TemperatureRuleFormState = { status: "idle" };
  const [, formAction, isPending] = useActionState(deleteTemperatureRuleAction, idleState);
  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={ruleId} />
      <Button type="submit" variant="ghost" size="icon" disabled={isPending} title="Excluir regra">
        <Trash2 size={16} strokeWidth={1.75} />
      </Button>
    </form>
  );
}

export function TemperatureRulesList({
  rules,
  dealFields,
}: {
  rules: TemperatureRuleRow[];
  dealFields: DealFieldOption[];
}) {
  const [order, setOrder] = useState(rules);
  const [, startTransition] = useTransition();

  function move(index: number, direction: "up" | "down") {
    const swapWith = direction === "up" ? index - 1 : index + 1;
    if (swapWith < 0 || swapWith >= order.length) return;
    const next = [...order];
    [next[index], next[swapWith]] = [next[swapWith], next[index]];
    setOrder(next);
    startTransition(() => {
      void reorderTemperatureRulesAction(next.map((r) => r.id));
    });
  }

  if (dealFields.length === 0 && order.length === 0) {
    return (
      <EmptyState
        icon={Thermometer}
        title="Nenhum campo customizado de negócio ainda"
        description="Crie campos customizados de negócio (Configurações > Campos Customizados) antes de montar regras de temperatura — elas comparam valores desses campos."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <RuleFormDialog
          dealFields={dealFields}
          trigger={
            <Button type="button">
              <Plus size={16} strokeWidth={1.75} />
              Nova regra
            </Button>
          }
        />
      </div>

      {order.length === 0 ? (
        <EmptyState
          icon={Thermometer}
          title="Nenhuma regra cadastrada"
          description="Sem regras, negócios criados por webhook nunca recebem temperatura automática."
        />
      ) : (
        <div className="space-y-2">
          {order.map((rule, index) => (
            <div
              key={rule.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{rule.name}</span>
                  <Badge variant="outline" className={RESULT_BADGE_CLASS[rule.result]}>
                    {RESULT_LABELS[rule.result]}
                  </Badge>
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {summarizeConditions(rule.conditions, dealFields)}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={index === 0}
                  onClick={() => move(index, "up")}
                  title="Mover pra cima"
                >
                  <ArrowUp size={16} strokeWidth={1.75} />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={index === order.length - 1}
                  onClick={() => move(index, "down")}
                  title="Mover pra baixo"
                >
                  <ArrowDown size={16} strokeWidth={1.75} />
                </Button>
                <RuleFormDialog
                  rule={rule}
                  dealFields={dealFields}
                  trigger={
                    <Button type="button" variant="outline" size="sm">
                      Editar
                    </Button>
                  }
                />
                <DeleteRuleButton ruleId={rule.id} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
