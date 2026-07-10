"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TagPicker } from "@/components/tag-picker";
import { createTagQuickAction } from "@/app/configuracoes/tags/actions";
import type { TagOption } from "@/lib/tags";

// Seletor de tags EXISTENTES (nunca digitar um nome de tag pra mapear) com
// uma saída rápida pra criar uma tag nova sem sair da tela — usado nas
// telas de mapeamento de webhook/importação (Etapa 13), onde a tag
// selecionada é aplicada estaticamente a todo contato/negócio criado por
// aquele webhook/importação.
export function TagPickerWithCreate({
  allTags,
  selectedTagIds,
  onToggle,
  onTagCreated,
}: {
  allTags: TagOption[];
  selectedTagIds: Set<string>;
  onToggle: (tagId: string) => void;
  onTagCreated: (tag: TagOption) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#e59501");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleCreate() {
    if (!name.trim()) return;
    setIsPending(true);
    setError(null);
    const result = await createTagQuickAction(name.trim(), color);
    setIsPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onTagCreated(result.tag);
    onToggle(result.tag.id);
    setName("");
    setColor("#e59501");
    setCreating(false);
  }

  return (
    <div className="space-y-2">
      <TagPicker allTags={allTags} selectedTagIds={selectedTagIds} onToggle={onToggle} />
      {creating ? (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome da nova tag"
            className="h-8 w-40 text-sm"
          />
          <Input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-8 w-12 p-1"
          />
          <Button type="button" size="sm" disabled={isPending || !name.trim()} onClick={handleCreate}>
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
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <Plus size={12} strokeWidth={1.75} />
          Nova tag
        </button>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
