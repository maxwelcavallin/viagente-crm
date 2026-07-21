"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Combobox,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxInputGroup,
  ComboboxItem,
  ComboboxList,
  ComboboxPopup,
} from "@/components/ui/combobox";
import { EmptyState } from "@/components/ui/empty-state";
import { Radio, X } from "lucide-react";
import { FieldQuickCreate } from "@/components/field-quick-create";
import { CONTACT_SYSTEM_FIELDS, flattenPayloadPaths } from "@/lib/webhook-fields";
import type { FieldDef } from "@/lib/custom-fields";
import { updateFieldMappingAction } from "../actions";

const IGNORE_VALUE = "__nao_mapear__";

// Mesma lista de campos de destino da importação de CSV (ver buildMappingOptions
// em import-wizard.tsx), sem os campos de negócio que o webhook de entrada não
// usa (deal.title/value/status — webhook sempre cria negócio "aberto" com
// título derivado do nome do contato).
function buildTargetOptions(contactFieldDefs: FieldDef[], dealFieldDefs: FieldDef[]) {
  return [
    ...CONTACT_SYSTEM_FIELDS,
    ...contactFieldDefs.map((f) => ({ key: `contact.custom.${f.key}`, label: `${f.label} (contato)` })),
    ...dealFieldDefs.map((f) => ({ key: `deal.custom.${f.key}`, label: `${f.label} (negócio)` })),
  ].sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
}

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
  path,
  preview,
  target,
  comboboxItems,
  stale,
  onChange,
  onRemove,
}: {
  path: string;
  preview: string;
  target: string;
  comboboxItems: { value: string; label: string }[];
  stale: boolean;
  onChange: (target: string) => void;
  onRemove?: () => void;
}) {
  const selectedItem = comboboxItems.find((o) => o.value === target) ?? null;
  return (
    <div className="grid grid-cols-1 items-center gap-2 rounded-lg border border-border p-2.5 sm:grid-cols-[1fr_1fr_auto]">
      <div className="min-w-0">
        <p className="truncate font-mono text-sm font-medium" title={path}>
          {path}
        </p>
        <p className="truncate text-xs text-muted-foreground" title={preview}>
          {stale ? "não está no payload de referência atual" : preview}
        </p>
      </div>
      <Combobox
        items={comboboxItems}
        value={selectedItem}
        onValueChange={(item) => onChange(item?.value ?? IGNORE_VALUE)}
      >
        <ComboboxInputGroup>
          <ComboboxInput placeholder="Buscar campo..." />
        </ComboboxInputGroup>
        <ComboboxPopup>
          <ComboboxEmpty>Nenhum campo encontrado.</ComboboxEmpty>
          <ComboboxList>
            {(item: { value: string; label: string }) => (
              <ComboboxItem key={item.value} value={item}>
                {item.label}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxPopup>
      </Combobox>
      {stale && onRemove ? (
        <Button type="button" variant="ghost" size="icon" onClick={onRemove} title="Remover mapeamento">
          <X size={16} strokeWidth={1.75} />
        </Button>
      ) : (
        <div />
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

  const targetOptions = useMemo(
    () => buildTargetOptions(contactFields, dealFields),
    [contactFields, dealFields]
  );
  // Itens do combobox precisam ser objetos estáveis (mesma referência entre
  // renders) pra o Combobox conseguir casar o "value" selecionado com o item
  // certo da lista — ver mesma observação em import-wizard.tsx.
  const comboboxItems = useMemo(
    () => [
      { value: IGNORE_VALUE, label: "Não mapear" },
      ...targetOptions.map((o) => ({ value: o.key, label: o.label })),
    ],
    [targetOptions]
  );

  // O campo de destino de cada linha vem do payload que chega no webhook, não
  // o inverso — nem todo campo customizável do CRM aparece em toda origem, e
  // listar todos fixos na tela (como era antes) obrigava a rolar dezenas de
  // campos irrelevantes pra essa origem específica.
  function setTargetForPath(path: string, target: string) {
    setSaved(false);
    setMapping((prev) => {
      const next = { ...prev };
      for (const [key, value] of Object.entries(next)) {
        if (value === path) delete next[key];
      }
      if (target !== IGNORE_VALUE) next[target] = path;
      return next;
    });
  }

  function removeMapping(target: string) {
    setSaved(false);
    setMapping((prev) => {
      const next = { ...prev };
      delete next[target];
      return next;
    });
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
  const discoveredPaths = useMemo(() => new Set(discovered.map((d) => d.path)), [discovered]);
  const pathToTarget = useMemo(() => {
    const map = new Map<string, string>();
    for (const [key, value] of Object.entries(mapping)) {
      if (value) map.set(value, key);
    }
    return map;
  }, [mapping]);

  // Campo do CRM já escolhido por OUTRA linha some da busca — sem isso dava
  // pra selecionar o mesmo campo em duas linhas, e a segunda escolha roubava
  // o mapeamento da primeira em silêncio (setTargetForPath só permite um
  // path por target). A própria linha sempre mantém seu valor atual na
  // lista, senão o Select ficaria sem a opção que já está selecionada nela.
  const usedTargets = useMemo(() => new Set(Object.keys(mapping)), [mapping]);
  function itemsForRow(currentTarget: string) {
    return comboboxItems.filter(
      (item) =>
        item.value === IGNORE_VALUE ||
        item.value === currentTarget ||
        !usedTargets.has(item.value)
    );
  }

  // Mapeamentos já salvos cujo caminho não aparece no payload de referência
  // escolhido agora (veio de outra execução, ou o payload mudou de formato) —
  // continuam visíveis e editáveis, nunca somem sozinhos.
  const staleRows = Object.entries(mapping)
    .filter(([, path]) => path && !discoveredPaths.has(path))
    .map(([target, path]) => ({ path, target }));

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

      <p className="text-sm text-muted-foreground">
        Pra cada campo que chegou nesse payload, escolha em qual campo do CRM ele deve entrar (ou
        deixe como &quot;Não mapear&quot;).
      </p>

      <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
        {discovered.map((field) => {
          const target = pathToTarget.get(field.path) ?? IGNORE_VALUE;
          return (
          <MappingRow
            key={field.path}
            path={field.path}
            preview={field.preview}
            target={target}
            comboboxItems={itemsForRow(target)}
            stale={false}
            onChange={(t) => setTargetForPath(field.path, t)}
          />
          );
        })}
        {staleRows.map((row) => (
          <MappingRow
            key={row.target}
            path={row.path}
            preview=""
            target={row.target}
            comboboxItems={itemsForRow(row.target)}
            stale
            onChange={(target) => setTargetForPath(row.path, target)}
            onRemove={() => removeMapping(row.target)}
          />
        ))}
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
