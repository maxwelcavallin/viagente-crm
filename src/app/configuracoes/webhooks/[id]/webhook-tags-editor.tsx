"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { TagPickerWithCreate } from "@/components/tag-picker-with-create";
import type { TagOption } from "@/lib/tags";
import { updateWebhookTagsAction } from "../actions";

// Seção separada do mapeamento de campos (Etapa 13): tags aqui são
// estáticas — aplicadas a TODO contato/negócio criado por este webhook,
// pra identificar a origem. Nunca digitadas: sempre selecionadas de tags
// já existentes, com opção de criar uma nova na hora.
export function WebhookTagsEditor({
  webhookId,
  allTags: initialAllTags,
  initialContactTagIds,
  initialDealTagIds,
}: {
  webhookId: string;
  allTags: TagOption[];
  initialContactTagIds: string[];
  initialDealTagIds: string[];
}) {
  const router = useRouter();
  const [allTags, setAllTags] = useState(initialAllTags);
  const [contactTagIds, setContactTagIds] = useState(new Set(initialContactTagIds));
  const [dealTagIds, setDealTagIds] = useState(new Set(initialDealTagIds));
  const [isPending, setIsPending] = useState(false);
  const [saved, setSaved] = useState(false);

  function addTag(tag: TagOption) {
    setAllTags((prev) => [...prev, tag]);
  }

  function toggleContactTag(tagId: string) {
    setSaved(false);
    setContactTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) next.delete(tagId);
      else next.add(tagId);
      return next;
    });
  }

  function toggleDealTag(tagId: string) {
    setSaved(false);
    setDealTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) next.delete(tagId);
      else next.add(tagId);
      return next;
    });
  }

  async function handleSave() {
    setIsPending(true);
    const result = await updateWebhookTagsAction(
      webhookId,
      Array.from(contactTagIds),
      Array.from(dealTagIds)
    );
    setIsPending(false);
    if (result.ok) {
      setSaved(true);
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Aplicadas automaticamente a todo contato/negócio criado por este webhook — útil pra
        identificar a origem depois.
      </p>
      <div className="space-y-2">
        <Label>Tags do contato</Label>
        <TagPickerWithCreate
          allTags={allTags}
          selectedTagIds={contactTagIds}
          onToggle={toggleContactTag}
          onTagCreated={addTag}
        />
      </div>
      <div className="space-y-2">
        <Label>Tags do negócio</Label>
        <TagPickerWithCreate
          allTags={allTags}
          selectedTagIds={dealTagIds}
          onToggle={toggleDealTag}
          onTagCreated={addTag}
        />
      </div>
      <div className="flex items-center gap-3">
        <Button type="button" onClick={handleSave} disabled={isPending}>
          {isPending ? "Salvando..." : "Salvar tags"}
        </Button>
        {saved && <span className="text-sm text-status-success">Salvo.</span>}
      </div>
    </div>
  );
}
