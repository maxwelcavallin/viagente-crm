"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createFieldQuickAction } from "@/app/configuracoes/campos/actions";
import type { FieldDef } from "@/lib/custom-fields";

const TYPE_LABELS: Record<string, string> = {
  texto: "Texto",
  numero: "Número",
  data: "Data",
};

// Criação rápida de campo customizado embutida nas telas de mapeamento —
// só tipos simples (sem opções extras); campos "select" continuam exigindo
// a tela completa em /configuracoes/campos.
export function FieldQuickCreate({
  entity,
  onFieldCreated,
}: {
  entity: "contact" | "deal";
  onFieldCreated: (field: FieldDef) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [label, setLabel] = useState("");
  const [type, setType] = useState<"texto" | "numero" | "data">("texto");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleCreate() {
    if (!label.trim()) return;
    setIsPending(true);
    setError(null);
    const result = await createFieldQuickAction(entity, label.trim(), type);
    setIsPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onFieldCreated(result.field);
    setLabel("");
    setType("texto");
    setCreating(false);
  }

  if (!creating) {
    return (
      <button
        type="button"
        onClick={() => setCreating(true)}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <Plus size={12} strokeWidth={1.75} />
        Novo campo {entity === "contact" ? "de contato" : "de negócio"}
      </button>
    );
  }

  return (
    <div className="space-y-1.5 rounded-lg border border-dashed border-border p-2">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Label do campo"
          className="h-8 w-40 text-sm"
        />
        <Select items={TYPE_LABELS} value={type} onValueChange={(v) => setType((v as typeof type) ?? "texto")}>
          <SelectTrigger className="h-8 w-28 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(TYPE_LABELS).map(([value, l]) => (
              <SelectItem key={value} value={value}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" size="sm" disabled={isPending || !label.trim()} onClick={handleCreate}>
          {isPending ? "Criando..." : "Criar"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            setCreating(false);
            setError(null);
          }}
        >
          Cancelar
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Pra campos do tipo select (com opções), crie em Configurações → Campos Customizados.
      </p>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
