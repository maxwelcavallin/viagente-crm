"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { CustomFieldInput } from "@/components/custom-field-input";
import { TagPicker } from "@/components/tag-picker";
import type { FieldDef } from "@/lib/custom-fields";
import type { TagOption } from "@/lib/tags";
import {
  createContactAction,
  updateContactAction,
  type ContactFormState,
} from "./actions";

export type { FieldDef } from "@/lib/custom-fields";
export type { TagOption } from "@/lib/tags";

export type ContactData = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  customFields: Record<string, unknown>;
  tagIds: string[];
};

const idleState: ContactFormState = { status: "idle" };

export function ContactFormDialog({
  mode,
  contact,
  fieldDefinitions,
  allTags,
  trigger,
  triggerLabel,
}: {
  mode: "create" | "edit";
  contact?: ContactData;
  fieldDefinitions: FieldDef[];
  allTags: TagOption[];
  trigger: React.ReactElement;
  triggerLabel: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(
    new Set(contact?.tagIds ?? [])
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const action = mode === "create" ? createContactAction : updateContactAction;

  async function handleSubmit(formData: FormData) {
    setIsPending(true);
    setError(null);
    const result = await action(idleState, formData);
    setIsPending(false);
    if (result.status === "error") {
      setError(result.message);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  function toggleTag(tagId: string) {
    setSelectedTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) next.delete(tagId);
      else next.add(tagId);
      return next;
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger}>{triggerLabel}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Novo contato" : `Editar ${contact?.name}`}
          </DialogTitle>
          <DialogDescription>
            Telefone é obrigatório e único — não é possível cadastrar dois
            contatos com o mesmo número.
          </DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          {mode === "edit" && contact && (
            <input type="hidden" name="id" value={contact.id} />
          )}
          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input id="name" name="name" defaultValue={contact?.name} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Telefone</Label>
            <Input id="phone" name="phone" defaultValue={contact?.phone} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" defaultValue={contact?.email ?? ""} />
          </div>

          {fieldDefinitions.map((field) => (
            <div key={field.id} className="space-y-2">
              <Label htmlFor={`custom_${field.key}`}>{field.label}</Label>
              <CustomFieldInput
                field={field}
                defaultValue={
                  contact?.customFields?.[field.key] != null
                    ? String(contact.customFields[field.key])
                    : ""
                }
              />
            </div>
          ))}

          <TagPicker
            allTags={allTags}
            selectedTagIds={selectedTagIds}
            onToggle={toggleTag}
          />

          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancelar
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? "Salvando..."
                : mode === "create"
                  ? "Criar contato"
                  : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
