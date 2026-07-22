"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
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
import type { TagOption } from "@/lib/tags";
import { updateDynamicTagMappingAction } from "../actions";

type MappingRow = { value: string; tagId: string | null };

// Bloco separado das tags fixas (webhook-tags-editor.tsx): aquelas aplicam
// sempre, igual pra todo contato/negócio do webhook; esta resolve o valor de
// um campo do payload (ex: "payload.classificacao") e aplica a tag do
// negócio que casar com ele — as duas coexistem sem conflito.
export function WebhookDynamicTagEditor({
  webhookId,
  allTags,
  initialField,
  initialMapping,
  initialDefaultTagId,
}: {
  webhookId: string;
  allTags: TagOption[];
  initialField: string | null;
  initialMapping: { value: string; tagId: string }[];
  initialDefaultTagId: string | null;
}) {
  const router = useRouter();
  const [field, setField] = useState(initialField ?? "");
  const [rows, setRows] = useState<MappingRow[]>(
    initialMapping.length > 0
      ? initialMapping.map((m) => ({ value: m.value, tagId: m.tagId }))
      : [{ value: "", tagId: null }]
  );
  const [defaultTagId, setDefaultTagId] = useState<string | null>(initialDefaultTagId);
  const [isPending, setIsPending] = useState(false);
  const [saved, setSaved] = useState(false);

  const tagItems = Object.fromEntries(allTags.map((t) => [t.id, t.name]));

  function updateRow(index: number, next: Partial<MappingRow>) {
    setSaved(false);
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...next } : r)));
  }

  function addRow() {
    setSaved(false);
    setRows((prev) => [...prev, { value: "", tagId: null }]);
  }

  function removeRow(index: number) {
    setSaved(false);
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    setIsPending(true);
    const cleaned = rows
      .filter((r): r is { value: string; tagId: string } => r.value.trim() !== "" && r.tagId !== null)
      .map((r) => ({ value: r.value.trim(), tagId: r.tagId }));
    const result = await updateDynamicTagMappingAction(webhookId, field, cleaned, defaultTagId);
    setIsPending(false);
    if (result.ok) {
      setSaved(true);
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Além das tags fixas acima, aplique uma tag diferente dependendo de um valor que veio no
        próprio payload — ex: um único webhook classificando o lead como &quot;MQL&quot;,
        &quot;Lead quente&quot; ou &quot;Não-MQL&quot; em vez de precisar de um webhook por
        desfecho.
      </p>

      <div className="space-y-1">
        <Label className="text-xs">Caminho no payload com o valor de classificação</Label>
        <Input
          value={field}
          onChange={(e) => {
            setSaved(false);
            setField(e.target.value);
          }}
          placeholder="ex: payload.classificacao"
          className="font-mono text-sm"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Valor recebido → tag</Label>
        {rows.map((row, index) => (
          <div key={index} className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <Input
              value={row.value}
              onChange={(e) => updateRow(index, { value: e.target.value })}
              placeholder="ex: mql"
              className="font-mono text-sm"
            />
            <Select
              items={tagItems}
              value={row.tagId}
              onValueChange={(v) => updateRow(index, { tagId: v ?? null })}
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
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeRow(index)}
              title="Remover linha"
            >
              <X size={16} strokeWidth={1.75} />
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={addRow}>
          <Plus size={14} strokeWidth={1.75} />
          Adicionar valor
        </Button>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Tag padrão (quando o valor não bater com nada acima)</Label>
        <Select
          items={{ __nenhuma__: "Nenhuma", ...tagItems }}
          value={defaultTagId ?? "__nenhuma__"}
          onValueChange={(v) => setDefaultTagId(!v || v === "__nenhuma__" ? null : v)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Nenhuma" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__nenhuma__">Nenhuma</SelectItem>
            {allTags.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-3">
        <Button type="button" onClick={handleSave} disabled={isPending}>
          {isPending ? "Salvando..." : "Salvar mapeamento dinâmico"}
        </Button>
        {saved && <span className="text-sm text-status-success">Salvo.</span>}
      </div>
    </div>
  );
}
