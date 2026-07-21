"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown, Search, UserPlus } from "lucide-react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CustomFieldInput } from "@/components/custom-field-input";
import { TagPicker } from "@/components/tag-picker";
import type { FieldDef } from "@/lib/custom-fields";
import { formatBrazilianPhoneMask } from "@/lib/phone";
import type { TagOption } from "@/lib/tags";
import { createContactAction } from "@/app/contatos/actions";
import {
  createDealAction,
  updateDealAction,
  type DealFormState,
} from "./actions";

export type DealFormContact = { id: string; name: string; phone: string | null };
export type DealFormOwner = { id: string; name: string };
export type DealFormPipeline = { id: string; name: string };
export type DealFormStage = {
  id: string;
  name: string;
  pipelineId: string;
  order: number;
};

export type DealData = {
  id: string;
  title: string;
  contactId: string;
  pipelineId: string;
  stageId: string;
  ownerId: string | null;
  value: string | null;
  customFields: Record<string, unknown>;
  tagIds: string[];
};

const idleState: DealFormState = { status: "idle" };

function ContactPicker({
  contacts,
  selectedContactId,
  onSelect,
}: {
  contacts: DealFormContact[];
  selectedContactId: string;
  onSelect: (contact: DealFormContact) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [creatingError, setCreatingError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const selected = contacts.find((c) => c.id === selectedContactId);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return contacts.slice(0, 30);
    return contacts
      .filter(
        (c) =>
          c.name.toLowerCase().includes(term) ||
          (c.phone?.toLowerCase().includes(term) ?? false)
      )
      .slice(0, 30);
  }, [contacts, search]);

  async function handleCreateContact() {
    if (!newName.trim() || !newPhone.trim()) {
      setCreatingError("Nome e telefone são obrigatórios.");
      return;
    }
    setIsPending(true);
    setCreatingError(null);
    const formData = new FormData();
    formData.set("name", newName.trim());
    formData.set("phone", newPhone.trim());
    const result = await createContactAction(
      { status: "idle" },
      formData
    );
    setIsPending(false);
    if (result.status === "error") {
      setCreatingError(result.message);
      return;
    }
    if (result.status === "duplicate") {
      // Já existe um contato com esse telefone/email — usa ele em vez de
      // criar duplicado (mesma lógica de "vincular" em vez de duplicar).
      const existing = contacts.find((c) => c.id === result.existingContactId);
      onSelect({
        id: result.existingContactId,
        name: existing?.name ?? result.existingContactName,
        phone: existing?.phone ?? null,
      });
      setCreating(false);
      setNewName("");
      setNewPhone("");
      setOpen(false);
      return;
    }
    if (result.status !== "success") return;
    onSelect({ id: result.contactId, name: newName.trim(), phone: newPhone.trim() });
    setCreating(false);
    setNewName("");
    setNewPhone("");
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            className="w-full justify-between font-normal"
          />
        }
      >
        {selected ? (
          <span className="truncate">
            {selected.name}
            {selected.phone && (
              <span className="text-muted-foreground"> — {selected.phone}</span>
            )}
          </span>
        ) : (
          <span className="text-muted-foreground">Selecionar contato...</span>
        )}
        <ChevronsUpDown size={14} strokeWidth={1.75} className="shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-80 p-2" align="start">
        {creating ? (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              Criar novo contato
            </p>
            <Input
              placeholder="Nome"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <Input
              placeholder="(18) 99679-8226"
              type="tel"
              inputMode="numeric"
              value={newPhone}
              onChange={(e) => setNewPhone(formatBrazilianPhoneMask(e.target.value))}
            />
            {creatingError && (
              <p className="text-xs text-destructive">{creatingError}</p>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCreating(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={isPending}
                onClick={handleCreateContact}
              >
                {isPending ? "Criando..." : "Criar e vincular"}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="relative mb-2">
              <Search
                size={14}
                strokeWidth={1.75}
                className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar contato..."
                className="h-8 pl-7 text-sm"
              />
            </div>
            <div className="max-h-56 space-y-0.5 overflow-y-auto">
              {filtered.length === 0 && (
                <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                  Nenhum contato encontrado.
                </p>
              )}
              {filtered.map((contact) => (
                <button
                  key={contact.id}
                  type="button"
                  onClick={() => {
                    onSelect(contact);
                    setOpen(false);
                  }}
                  className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                >
                  <span className="truncate">
                    {contact.name}
                    {contact.phone && (
                      <span className="text-muted-foreground"> — {contact.phone}</span>
                    )}
                  </span>
                  {contact.id === selectedContactId && (
                    <Check size={14} strokeWidth={1.75} className="shrink-0" />
                  )}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="mt-1 flex w-full items-center gap-2 rounded-md border-t border-border px-2 py-2 text-left text-sm text-primary hover:bg-accent"
            >
              <UserPlus size={14} strokeWidth={1.75} />
              Criar novo contato
            </button>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

export type DealFormProps = {
  pipelines: DealFormPipeline[];
  stages: DealFormStage[];
  contacts: DealFormContact[];
  owners: DealFormOwner[];
  fieldDefinitions: FieldDef[];
  allTags: TagOption[];
  currentUserId: string;
  defaultPipelineId?: string;
  defaultStageId?: string;
  // Quando informado, o contato vem fixo (ex: criar negócio a partir da
  // página do contato) — some com o ContactPicker, não dá pra trocar.
  lockedContact?: DealFormContact;
};

export function DealFormDialog({
  mode,
  deal,
  pipelines,
  stages,
  contacts,
  owners,
  fieldDefinitions,
  allTags,
  currentUserId,
  defaultPipelineId,
  defaultStageId,
  lockedContact,
  trigger,
  triggerLabel,
}: DealFormProps & {
  mode: "create" | "edit";
  deal?: DealData;
  trigger: React.ReactElement;
  triggerLabel: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [contactsList, setContactsList] = useState(contacts);
  const [contactId, setContactId] = useState(
    deal?.contactId ?? lockedContact?.id ?? ""
  );
  const [pipelineId, setPipelineId] = useState(
    deal?.pipelineId ?? defaultPipelineId ?? pipelines[0]?.id ?? ""
  );
  const [stageId, setStageId] = useState(
    deal?.stageId ?? defaultStageId ?? ""
  );
  const [ownerId, setOwnerId] = useState(
    deal?.ownerId ?? (mode === "create" ? currentUserId : "")
  );
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(
    new Set(deal?.tagIds ?? [])
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const action = mode === "create" ? createDealAction : updateDealAction;

  const stagesForPipeline = useMemo(
    () =>
      stages
        .filter((s) => s.pipelineId === pipelineId)
        .sort((a, b) => a.order - b.order),
    [stages, pipelineId]
  );

  function handlePipelineChange(nextPipelineId: string) {
    setPipelineId(nextPipelineId);
    const firstStage = stages
      .filter((s) => s.pipelineId === nextPipelineId)
      .sort((a, b) => a.order - b.order)[0];
    setStageId(firstStage?.id ?? "");
  }

  async function handleSubmit(formData: FormData) {
    if (!contactId) {
      setError("Selecione ou crie um contato.");
      return;
    }
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
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(null);
      }}
    >
      <DialogTrigger render={trigger}>{triggerLabel}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Novo negócio" : `Editar ${deal?.title}`}
          </DialogTitle>
          <DialogDescription>
            Título é opcional — se vazio, usa o nome do contato.
          </DialogDescription>
        </DialogHeader>
        <form
          action={handleSubmit}
          className="max-h-[70vh] space-y-4 overflow-y-auto pr-1"
        >
          {mode === "edit" && deal && (
            <input type="hidden" name="id" value={deal.id} />
          )}
          <input type="hidden" name="contactId" value={contactId} />
          <input type="hidden" name="pipelineId" value={pipelineId} />
          <input type="hidden" name="stageId" value={stageId} />
          <input type="hidden" name="ownerId" value={ownerId} />

          <div className="space-y-2">
            <Label htmlFor="title">Título</Label>
            <Input id="title" name="title" defaultValue={deal?.title} />
          </div>

          <div className="space-y-2">
            <Label>Contato</Label>
            {lockedContact ? (
              <div className="flex items-center rounded-md border border-input bg-muted/40 px-3 py-2 text-sm">
                {lockedContact.name}
                {lockedContact.phone && (
                  <span className="ml-1 text-muted-foreground">— {lockedContact.phone}</span>
                )}
              </div>
            ) : (
              <ContactPicker
                contacts={contactsList}
                selectedContactId={contactId}
                onSelect={(contact) => {
                  setContactId(contact.id);
                  setContactsList((prev) =>
                    prev.some((c) => c.id === contact.id) ? prev : [contact, ...prev]
                  );
                }}
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Pipeline</Label>
              <Select
                items={Object.fromEntries(pipelines.map((p) => [p.id, p.name]))}
                value={pipelineId}
                onValueChange={(value) => handlePipelineChange(value ?? "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pipeline" />
                </SelectTrigger>
                <SelectContent>
                  {pipelines.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Etapa</Label>
              <Select
                items={Object.fromEntries(
                  stagesForPipeline.map((s) => [s.id, s.name])
                )}
                value={stageId}
                onValueChange={(value) => setStageId(value ?? "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Etapa" />
                </SelectTrigger>
                <SelectContent>
                  {stagesForPipeline.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="value">Valor (R$)</Label>
              <Input
                id="value"
                name="value"
                type="number"
                step="0.01"
                min="0"
                defaultValue={deal?.value ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label>Dono do negócio</Label>
              <Select
                items={Object.fromEntries(owners.map((o) => [o.id, o.name]))}
                value={ownerId}
                onValueChange={(value) => setOwnerId(value ?? "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sem dono" />
                </SelectTrigger>
                <SelectContent>
                  {owners.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {fieldDefinitions.map((field) => (
            <div key={field.id} className="space-y-2">
              <Label htmlFor={`custom_${field.key}`}>{field.label}</Label>
              <CustomFieldInput
                field={field}
                defaultValue={
                  deal?.customFields?.[field.key] != null
                    ? String(deal.customFields[field.key])
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
                  ? "Criar negócio"
                  : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
