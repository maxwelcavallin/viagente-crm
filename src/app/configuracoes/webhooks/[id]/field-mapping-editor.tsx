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
import { EmptyState } from "@/components/ui/empty-state";
import { Radio } from "lucide-react";
import { FieldQuickCreate } from "@/components/field-quick-create";
import { CONTACT_SYSTEM_FIELDS, flattenPayloadPaths } from "@/lib/webhook-fields";
import type { FieldDef } from "@/lib/custom-fields";
import { updateFieldMappingAction } from "../actions";

// Valor sentinela do select pra "digitar manualmente" — nunca colide com um
// caminho de payload real, que sempre tem pelo menos um "." ou é uma chave
// de nível raiz (nunca igual a essa string exata).
const MANUAL_ENTRY = "__digitar_manualmente__";

function ExecutionPicker({
  executions,
  selectedId,
  onSelect,
}: {
  executions: { id: string; createdAt: Date; payload: unknown }[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <Select
      items={Object.fromEntries(
        executions.map((e) => [
          e.id,
          new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(
            e.createdAt
          ),
        ])
      )}
      value={selectedId}
      onValueChange={(v) => v && onSelect(v)}
    >
      <SelectTrigger className="w-56">
        <SelectValue placeholder="Escolha uma execução" />
      </SelectTrigger>
      <SelectContent>
        {executions.map((e) => (
          <SelectItem key={e.id} value={e.id}>
            {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(
              e.createdAt
            )}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function MappingRow({
  label,
  value,
  discovered,
  onChange,
}: {
  label: string;
  value: string;
  discovered: { path: string; preview: string }[];
  onChange: (path: string) => void;
}) {
  // Um caminho já salvo que não aparece no payload de referência atual (veio
  // de outra execução, ou foi digitado antes dessa opção existir) continua
  // selecionável — nunca lo perdemos por não bater com o payload escolhido
  // agora.
  const options = value && !discovered.some((d) => d.path === value)
    ? [{ path: value, preview: "não está no payload de referência atual" }, ...discovered]
    : discovered;
  const isManual = value !== "" && !options.some((o) => o.path === value);

  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Select
        items={Object.fromEntries([
          ["", "— não mapeado —"],
          ...options.map((o) => [o.path, `${o.path}  (${o.preview})`]),
          [MANUAL_ENTRY, "Digitar manualmente..."],
        ])}
        value={isManual ? MANUAL_ENTRY : value || ""}
        onValueChange={(v) => {
          if (v === MANUAL_ENTRY) {
            onChange(" "); // valor não-vazio pra cair no modo manual abaixo, sem escolher um caminho ainda
            return;
          }
          onChange(v ?? "");
        }}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="— não mapeado —" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">— não mapeado —</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.path} value={o.path} className="font-mono text-xs">
              {o.path} <span className="text-muted-foreground">({o.preview})</span>
            </SelectItem>
          ))}
          <SelectItem value={MANUAL_ENTRY}>Digitar manualmente...</SelectItem>
        </SelectContent>
      </Select>
      {isManual && (
        <Input
          value={value.trim()}
          onChange={(e) => onChange(e.target.value)}
          placeholder="ex: answers.gasto_cartao"
          className="font-mono text-xs"
          autoFocus
        />
      )}
    </div>
  );
}

export function FieldMappingEditor({
  webhookId,
  initialMapping,
  contactFieldDefs,
  dealFieldDefs,
  recentExecutions,
}: {
  webhookId: string;
  initialMapping: Record<string, string>;
  contactFieldDefs: FieldDef[];
  dealFieldDefs: FieldDef[];
  recentExecutions: { id: string; createdAt: Date; payload: unknown }[];
}) {
  const router = useRouter();
  const [mapping, setMapping] = useState<Record<string, string>>(initialMapping);
  const [contactFields, setContactFields] = useState(contactFieldDefs);
  const [dealFields, setDealFields] = useState(dealFieldDefs);
  const [isPending, setIsPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [executionId, setExecutionId] = useState<string | null>(
    recentExecutions[0]?.id ?? null
  );

  function setPath(key: string, path: string) {
    setSaved(false);
    setMapping((prev) => ({ ...prev, [key]: path }));
  }

  async function handleSave() {
    setIsPending(true);
    const cleaned = Object.fromEntries(
      Object.entries(mapping).filter(([, v]) => v.trim())
    );
    const result = await updateFieldMappingAction(webhookId, cleaned);
    setIsPending(false);
    if (result.ok) {
      setSaved(true);
      router.refresh();
    }
  }

  const selectedExecution = recentExecutions.find((e) => e.id === executionId) ?? null;
  const discovered = useMemo(
    () => (selectedExecution ? flattenPayloadPaths(selectedExecution.payload) : []),
    [selectedExecution]
  );

  const systemRows = CONTACT_SYSTEM_FIELDS.map((f) => ({ key: f.key, label: f.label }));

  if (recentExecutions.length === 0) {
    return (
      <div className="space-y-3">
        <EmptyState
          icon={Radio}
          title="Aguardando o primeiro payload real"
          description='Chame a URL do webhook (acima) de verdade a partir da ferramenta de origem — mesmo que dê erro por falta de mapeamento, o payload chega aqui em "Execuções" e os campos ficam disponíveis pra selecionar abaixo, sem precisar digitar nada de cabeça.'
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Label className="text-xs whitespace-nowrap">Descobrir campos a partir de</Label>
        <ExecutionPicker
          executions={recentExecutions}
          selectedId={executionId}
          onSelect={setExecutionId}
        />
        {discovered.length === 0 && (
          <span className="text-xs text-status-warning">
            Esse payload não tem campos aproveitáveis (vazio ou só arrays).
          </span>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {systemRows.map((row) => (
          <MappingRow
            key={row.key}
            label={row.label}
            value={mapping[row.key] ?? ""}
            discovered={discovered}
            onChange={(path) => setPath(row.key, path)}
          />
        ))}
        {contactFields.map((f) => {
          const key = `contact.custom.${f.key}`;
          return (
            <MappingRow
              key={key}
              label={`${f.label} (contato)`}
              value={mapping[key] ?? ""}
              discovered={discovered}
              onChange={(path) => setPath(key, path)}
            />
          );
        })}
        {dealFields.map((f) => {
          const key = `deal.custom.${f.key}`;
          return (
            <MappingRow
              key={key}
              label={`${f.label} (negócio)`}
              value={mapping[key] ?? ""}
              discovered={discovered}
              onChange={(path) => setPath(key, path)}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap gap-4">
        <FieldQuickCreate
          entity="contact"
          onFieldCreated={(field) => setContactFields((prev) => [...prev, field])}
        />
        <FieldQuickCreate
          entity="deal"
          onFieldCreated={(field) => setDealFields((prev) => [...prev, field])}
        />
      </div>
      <div className="flex items-center gap-3">
        <Button type="button" onClick={handleSave} disabled={isPending}>
          {isPending ? "Salvando..." : "Salvar mapeamento"}
        </Button>
        {saved && <span className="text-sm text-status-success">Salvo.</span>}
      </div>
    </div>
  );
}
